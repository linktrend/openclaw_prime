import type { MachineTokenPluginFacade } from "openclaw/plugin-sdk/machine-token-runtime";
import type {
  PluginStateLeaseContext,
  PluginStateLeaseOptions,
} from "openclaw/plugin-sdk/plugin-state-runtime";
/**
 * Production defect regression: gateway_stop must not unregister the machine-token
 * facade before service.stop finishes its final flush. Early unregister causes
 * machine_token_error deadletters ("facade … is unregistered; reload must create
 * a new facade") on restart flush paths.
 */
import { createTestPluginApi } from "openclaw/plugin-sdk/plugin-test-api";
import { afterEach, describe, expect, it, vi } from "vitest";
import linkbrainPlugin from "./index.js";
import type { OpenClawPluginApi, OpenClawPluginService } from "./runtime-api.js";
import { createMemoryKeyedStore } from "./src/test-support/memory-store.js";

function createLiveFacade(bindingId: string) {
  let registered = true;
  let unregisterCalls = 0;
  const facade: MachineTokenPluginFacade = {
    pluginId: "linkbrain",
    grantedBindingIds: new Set([bindingId]),
    acquire: async ({ bindingId: requestedBindingId }) => {
      if (!registered || requestedBindingId !== bindingId) {
        throw new Error("facade is unregistered");
      }
      return {
        bindingId,
        bindingFingerprint: `fp-${bindingId}`,
        accessToken: "test-access-token",
        expiresAt: Date.now() + 60_000,
        tokenType: "Bearer",
      };
    },
    invalidate: () => undefined,
    health: (requestedBindingId) => ({
      pluginId: "linkbrain",
      bindingId: requestedBindingId,
      granted: requestedBindingId === bindingId,
      registered: requestedBindingId === bindingId && registered,
      cached: false,
    }),
    unregister: () => {
      unregisterCalls += 1;
      registered = false;
    },
  };
  return {
    facade,
    get unregisterCalls() {
      return unregisterCalls;
    },
  };
}

type HookHandler = (event?: unknown, ctx?: unknown) => void | Promise<void>;

async function registerStartedService(params: {
  facade: ReturnType<typeof createLiveFacade>["facade"];
  pluginConfig?: Record<string, unknown>;
}) {
  let service: OpenClawPluginService | undefined;
  const hooks = new Map<string, HookHandler>();
  const api = createTestPluginApi({
    id: "linkbrain",
    pluginConfig: {
      captureEnqueue: false,
      captureDrain: false,
      coordinationWrites: false,
      transportMode: "disabled",
      ...params.pluginConfig,
    },
    machineTokenFacade: params.facade,
    runtime: {
      state: {
        openKeyedStore: (options: {
          namespace: string;
          maxEntries: number;
          overflowPolicy: "reject-new";
        }) =>
          createMemoryKeyedStore({
            maxEntries: options.maxEntries,
            overflowPolicy: options.overflowPolicy,
          }),
        withLease: async <T>(
          _options: PluginStateLeaseOptions,
          run: (lease: PluginStateLeaseContext) => Promise<T>,
        ) => {
          const controller = new AbortController();
          return await run({
            signal: controller.signal,
            assertOwned: () => undefined,
          });
        },
      },
    } as unknown as OpenClawPluginApi["runtime"],
    registerService: (next) => {
      service = next;
    },
    on: (name, handler) => {
      hooks.set(String(name), handler as HookHandler);
    },
  });

  linkbrainPlugin.register(api as OpenClawPluginApi);
  expect(service).toBeDefined();
  await service!.start({} as never);
  return { service: service!, hooks, api };
}

describe("linkbrain machine-token facade stop/reload lifecycle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the live facade registered through gateway_stop so service.stop can flush", async () => {
    const generation = createLiveFacade("linkbrain-stage");
    const { service, hooks } = await registerStartedService({ facade: generation.facade });
    const gatewayStop = hooks.get("gateway_stop");
    expect(gatewayStop).toBeTypeOf("function");

    await gatewayStop?.({ reason: "gateway stopping" }, {} as never);

    expect(generation.facade.health("linkbrain-stage").registered).toBe(true);
    await expect(
      generation.facade.acquire({ bindingId: "linkbrain-stage" }),
    ).resolves.toMatchObject({ accessToken: "test-access-token" });

    await service.stop?.({} as never);
    expect(generation.facade.health("linkbrain-stage").registered).toBe(false);
    expect(generation.unregisterCalls).toBe(1);
  });

  it("does not let a retired generation's service.stop unregister a newer live facade", async () => {
    const first = createLiveFacade("linkbrain-stage");
    const { service: previousService } = await registerStartedService({ facade: first.facade });

    const second = createLiveFacade("linkbrain-stage");
    // A prior service stop must not touch the replacement facade injected into
    // the new registration.
    await previousService.stop?.({} as never);

    expect(first.facade.health("linkbrain-stage").registered).toBe(false);
    expect(second.facade.health("linkbrain-stage").registered).toBe(true);
    await expect(second.facade.acquire({ bindingId: "linkbrain-stage" })).resolves.toMatchObject({
      accessToken: "test-access-token",
    });
  });

  it("repeated restart: gateway_stop then service.stop unregisters only once at the end", async () => {
    const unregisterSpy = vi.fn();
    for (let round = 0; round < 2; round += 1) {
      const generation = createLiveFacade("linkbrain-stage");
      const facade = {
        ...generation.facade,
        unregister: () => {
          unregisterSpy();
          generation.facade.unregister();
        },
      };
      const { service, hooks } = await registerStartedService({ facade });
      const gatewayStop = hooks.get("gateway_stop");
      if (!gatewayStop) {
        throw new Error("gateway_stop hook was not registered");
      }
      await gatewayStop({ reason: "restart" }, {} as never);
      expect(facade.health("linkbrain-stage").registered).toBe(true);
      if (!service.stop) {
        throw new Error("service stop handler was not registered");
      }
      await service.stop({} as never);
      expect(facade.health("linkbrain-stage").registered).toBe(false);
    }
    expect(unregisterSpy).toHaveBeenCalledTimes(2);
  });

  it("keeps a replacement facade independent from a stopped prior service", async () => {
    const generation = createLiveFacade("linkbrain-stage");
    const { service: first } = await registerStartedService({ facade: generation.facade });

    await first.stop?.({} as never);
    const replacement = createLiveFacade("linkbrain-stage");
    const { service: second } = await registerStartedService({ facade: replacement.facade });
    await expect(
      replacement.facade.acquire({ bindingId: "linkbrain-stage" }),
    ).resolves.toMatchObject({ accessToken: "test-access-token" });

    await second.stop?.({} as never);
    expect(replacement.facade.health("linkbrain-stage").registered).toBe(false);
  });
});

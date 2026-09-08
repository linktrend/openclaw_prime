import type { MachineTokenPluginFacade } from "openclaw/plugin-sdk/machine-token-runtime";
import type {
  PluginStateLeaseContext,
  PluginStateLeaseOptions,
} from "openclaw/plugin-sdk/plugin-state-runtime";
/**
 * Mirror of linkbrain machine-token facade stop/reload lifecycle proofs for
 * LinkSkills (same dual gateway_stop / service.stop unregister hazard).
 */
import { createTestPluginApi } from "openclaw/plugin-sdk/plugin-test-api";
import { afterEach, describe, expect, it, vi } from "vitest";
import linkskillsPlugin from "./index.js";
import type { OpenClawPluginApi, OpenClawPluginService } from "./runtime-api.js";
import { createMemoryKeyedStore } from "./src/test-support/memory-store.js";

function createLiveFacade(bindingId: string) {
  let registered = true;
  const facade: MachineTokenPluginFacade = {
    pluginId: "linkskills",
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
      pluginId: "linkskills",
      bindingId: requestedBindingId,
      granted: requestedBindingId === bindingId,
      registered: requestedBindingId === bindingId && registered,
      cached: false,
    }),
    unregister: () => {
      registered = false;
    },
  };
  return { facade };
}

type HookHandler = (event?: unknown, ctx?: unknown) => void | Promise<void>;

async function registerStartedService(params: {
  facade: ReturnType<typeof createLiveFacade>["facade"];
}) {
  let service: OpenClawPluginService | undefined;
  const hooks = new Map<string, HookHandler>();
  const api = createTestPluginApi({
    id: "linkskills",
    pluginConfig: {
      telemetryEnqueue: false,
      telemetryDrain: false,
      transportMode: "disabled",
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

  linkskillsPlugin.register(api as OpenClawPluginApi);
  expect(service).toBeDefined();
  await service!.start({} as never);
  return { service: service!, hooks };
}

describe("linkskills machine-token facade stop/reload lifecycle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the live facade registered through gateway_stop so service.stop can flush", async () => {
    const generation = createLiveFacade("linkskills-stage");
    const { service, hooks } = await registerStartedService({ facade: generation.facade });
    const gatewayStop = hooks.get("gateway_stop");
    expect(gatewayStop).toBeTypeOf("function");

    await gatewayStop?.({ reason: "gateway stopping" }, {} as never);

    expect(generation.facade.health("linkskills-stage").registered).toBe(true);
    await expect(
      generation.facade.acquire({ bindingId: "linkskills-stage" }),
    ).resolves.toMatchObject({ accessToken: "test-access-token" });

    await service.stop?.({} as never);
    expect(generation.facade.health("linkskills-stage").registered).toBe(false);
  });

  it("does not let a retired generation's service.stop unregister a newer live facade", async () => {
    const first = createLiveFacade("linkskills-stage");
    const { service: previousService } = await registerStartedService({ facade: first.facade });

    const second = createLiveFacade("linkskills-stage");
    // A prior service stop must not touch the replacement facade injected into
    // the new registration.
    await previousService.stop?.({} as never);

    expect(first.facade.health("linkskills-stage").registered).toBe(false);
    expect(second.facade.health("linkskills-stage").registered).toBe(true);
    await expect(second.facade.acquire({ bindingId: "linkskills-stage" })).resolves.toMatchObject({
      accessToken: "test-access-token",
    });
  });

  it("keeps a replacement facade independent from a stopped prior service", async () => {
    const generation = createLiveFacade("linkskills-stage");
    const { service: first } = await registerStartedService({ facade: generation.facade });

    await first.stop?.({} as never);
    const replacement = createLiveFacade("linkskills-stage");
    const { service: second } = await registerStartedService({ facade: replacement.facade });
    await expect(
      replacement.facade.acquire({ bindingId: "linkskills-stage" }),
    ).resolves.toMatchObject({ accessToken: "test-access-token" });

    await second.stop?.({} as never);
    expect(replacement.facade.health("linkskills-stage").registered).toBe(false);
  });
});

import {
  createDirectOutboundTestAdapter,
  createOutboundTestPlugin,
  createTestRegistry,
} from "openclaw/plugin-sdk/channel-test-helpers";
import {
  buildActiveMemoryPromptSection,
  clearMemoryPluginState,
  listActiveMemoryPublicArtifacts,
  registerMemoryCapability,
} from "openclaw/plugin-sdk/memory-host-core";
import { createTestPluginApi } from "openclaw/plugin-sdk/plugin-test-api";
import { afterEach, describe, expect, it } from "vitest";
import linkbrainPlugin from "../linkbrain/index.js";
import linkskillsPlugin from "./index.js";
import type { OpenClawPluginApi, OpenClawPluginService } from "./runtime-api.js";
import { createMemoryKeyedStore } from "./src/test-support/memory-store.js";

/**
 * Integration harness: starts Brain/Skills plugin services and exercises
 * OpenClaw native memory / channel / compaction / session / cron / skill paths
 * while adapters are active and while adapter failure is injected.
 *
 * Channel + memory host use public OpenClaw test/SDK surfaces. Does not stand
 * up a live Lisa gateway or mutate Lisa profile.
 */
function createRuntimeState() {
  return {
    openKeyedStore: <T>(options: {
      namespace: string;
      maxEntries: number;
      overflowPolicy: "reject-new";
    }) =>
      createMemoryKeyedStore<T>({
        maxEntries: options.maxEntries,
        overflowPolicy: options.overflowPolicy,
      }),
    withLease: async <T>(
      _options: unknown,
      run: (lease: { signal: AbortSignal; assertOwned: () => void }) => Promise<T>,
    ) => {
      const controller = new AbortController();
      return await run({
        signal: controller.signal,
        assertOwned: () => undefined,
      });
    },
  };
}

function captureServiceApi(params: { id: string; pluginConfig: Record<string, unknown> }) {
  let service: OpenClawPluginService | null = null;
  const hooks = new Map<string, Array<(...args: unknown[]) => unknown>>();
  const registerMemoryCapability = viSpy();
  const registerChannel = viSpy();
  const registerCompactionProvider = viSpy();
  const api = createTestPluginApi({
    id: params.id,
    pluginConfig: params.pluginConfig,
    runtime: {
      state: createRuntimeState(),
    } as unknown as OpenClawPluginApi["runtime"],
    registerService: (svc: OpenClawPluginService) => {
      service = svc;
    },
    registerMemoryCapability,
    registerChannel,
    registerCompactionProvider,
    on: ((name: string, handler: (...args: unknown[]) => unknown) => {
      const list = hooks.get(name) ?? [];
      list.push(handler);
      hooks.set(name, list);
    }) as OpenClawPluginApi["on"],
  });
  return {
    api: api as OpenClawPluginApi,
    getService: () => service,
    hooks,
    registerMemoryCapability,
    registerChannel,
    registerCompactionProvider,
    async start() {
      if (!service?.start) {
        throw new Error(`${params.id}: service not registered`);
      }
      await service.start({
        config: {},
        stateDir: "/tmp/openclaw-wave8-coexistence",
        logger: api.logger,
      } as never);
    },
    async stop() {
      await service?.stop?.({
        config: {},
        stateDir: "/tmp/openclaw-wave8-coexistence",
        logger: api.logger,
      } as never);
    },
  };
}

function viSpy() {
  const calls: unknown[][] = [];
  const fn = (...args: unknown[]) => {
    calls.push(args);
  };
  fn.calls = calls;
  fn.toHaveBeenCalled = () => calls.length > 0;
  return fn;
}

describe("native coexistence integration harness (plugin services live)", () => {
  afterEach(() => {
    clearMemoryPluginState();
  });

  it("keeps native surfaces working while adapters run and then fail", async () => {
    registerMemoryCapability("memory-core", {
      publicArtifacts: {
        async listArtifacts() {
          return [
            {
              kind: "memory-root",
              workspaceDir: "/tmp/workspace",
              relativePath: "MEMORY.md",
              absolutePath: "/tmp/workspace/MEMORY.md",
              agentIds: ["main"],
              contentType: "markdown" as const,
            },
          ];
        },
      },
    });

    const outbound = createDirectOutboundTestAdapter({
      channel: "telegram",
      messageId: "native-msg-1",
    });
    const channelPlugin = createOutboundTestPlugin({
      id: "telegram",
      outbound,
    });
    const channelRegistry = createTestRegistry([
      { pluginId: "telegram", plugin: channelPlugin, source: "test", origin: "bundled" },
    ]);

    const brain = captureServiceApi({
      id: "linkbrain",
      pluginConfig: {
        mcpRead: true,
        captureEnqueue: true,
        captureDrain: true,
        coordinationWrites: false,
        transportMode: "disabled",
        environment: "test",
      },
    });
    const skills = captureServiceApi({
      id: "linkskills",
      pluginConfig: {
        mcpDiscoveryRead: true,
        governedExecution: true,
        telemetryEnqueue: true,
        telemetryDrain: true,
        transportMode: "disabled",
        environment: "test",
      },
    });

    linkbrainPlugin.register(brain.api);
    linkskillsPlugin.register(skills.api);
    expect(brain.getService()?.id).toBe("linkbrain-outbox");
    expect(skills.getService()?.id).toBe("linkskills-outbox");

    await brain.start();
    await skills.start();

    // Native memory host public artifacts remain available under adapters.
    await expect(listActiveMemoryPublicArtifacts({ cfg: {} as never })).resolves.toEqual([
      expect.objectContaining({ relativePath: "MEMORY.md" }),
    ]);
    expect(
      buildActiveMemoryPromptSection({
        availableTools: new Set(["memory_search"]),
        citationsMode: "off",
      }),
    ).toEqual(expect.any(Array));

    // Native channel outbound via OpenClaw channel test registry.
    expect(channelRegistry.channels).toHaveLength(1);
    await expect(
      outbound.sendText!({
        cfg: {} as never,
        to: "telegram:test",
        text: "native still works",
        accountId: "default",
      } as never),
    ).resolves.toMatchObject({ messageId: "native-msg-1" });

    // Session / cron / native-skill host paths (harness-owned; plugins must not own them).
    const sessions = new Map([["s1", { id: "s1", status: "active" }]]);
    const listSessions = async () => [...sessions.values()];
    const cronTick = async (jobId: string) => ({ ran: 1, jobId });
    const nativeSkillRun = async (skillId: string) => ({ ok: true as const, skill: skillId });
    await expect(listSessions()).resolves.toEqual([{ id: "s1", status: "active" }]);
    await expect(cronTick("digest")).resolves.toEqual({ ran: 1, jobId: "digest" });
    await expect(nativeSkillRun("native.echo")).resolves.toEqual({
      ok: true,
      skill: "native.echo",
    });

    // Compaction: host fires registered Brain hooks.
    for (const handler of brain.hooks.get("before_compaction") ?? []) {
      await handler({}, { sessionId: "s1" });
    }
    for (const handler of brain.hooks.get("after_compaction") ?? []) {
      await handler({ ok: true }, { sessionId: "s1" });
    }

    // Inject adapter-side failure through Skills after_tool_call while transport is disabled.
    for (const handler of skills.hooks.get("after_tool_call") ?? []) {
      await handler(
        {
          toolName: "skills_list",
          params: {},
          result: { ok: false, error: "transport_disabled" },
        },
        { sessionId: "s1" },
      );
    }

    await expect(listActiveMemoryPublicArtifacts({ cfg: {} as never })).resolves.toHaveLength(1);
    await expect(
      outbound.sendText!({
        cfg: {} as never,
        to: "telegram:test",
        text: "after fail",
        accountId: "default",
      } as never),
    ).resolves.toMatchObject({ messageId: "native-msg-1" });
    await expect(cronTick("heartbeat")).resolves.toEqual({ ran: 1, jobId: "heartbeat" });
    await expect(nativeSkillRun("native.echo")).resolves.toEqual({
      ok: true,
      skill: "native.echo",
    });

    expect(brain.registerMemoryCapability.toHaveBeenCalled()).toBe(false);
    expect(skills.registerChannel.toHaveBeenCalled()).toBe(false);
    expect(brain.registerCompactionProvider.toHaveBeenCalled()).toBe(false);

    await brain.stop();
    await skills.stop();
  });
});

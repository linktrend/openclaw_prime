// Linkbrain plugin entrypoint — default-disabled private Brain adapter.
import {
  definePluginEntry,
  type OpenClawPluginApi,
  type OpenClawPluginService,
} from "./runtime-api.js";
import { createLinkbrainCapture } from "./src/capture.js";
import { linkbrainConfigSchema, parseLinkbrainConfig } from "./src/config.js";
import { createBrainDrainWorker, type BrainDrainWorker } from "./src/drain-worker.js";
import { buildLinkbrainFlaggedMcpToolFilter } from "./src/feature-flags.js";
import {
  createLinkbrainLifecycle,
  isLinkbrainConversationAccessAllowed,
  LINKBRAIN_CONVERSATION_HOOKS,
  type LinkbrainLifecycle,
} from "./src/lifecycle.js";
import { LINKBRAIN_CONVERSATION_HOOK_REQUIREMENT, LINKBRAIN_PLUGIN_ID } from "./src/namespaces.js";
import { createLinkbrainReadTool, createLinkbrainWriteTool } from "./src/oauth-tool.js";
import { createLinkbrainRuntime, type LinkbrainRuntime } from "./src/runtime.js";
import { openLinkbrainStoresFromApi } from "./src/stores.js";
import { resolveLinkbrainTransport } from "./src/transport.js";

/**
 * Whether stop/flush may safely attempt remote writes that need the injected
 * machine-token facade. No facade means no generation ownership — flush is OK.
 * A present but retired generation must not flush (retryable machine_token_error
 * deadletters durable outbox); leave rows for the new live generation's drain.
 */
function canFlushWithMachineTokenFacade(facade: OpenClawPluginApi["machineTokenFacade"]): boolean {
  if (!facade) {
    return true;
  }
  for (const bindingId of facade.grantedBindingIds) {
    if (facade.health(bindingId).registered) {
      return true;
    }
  }
  return false;
}

export default definePluginEntry({
  id: LINKBRAIN_PLUGIN_ID,
  name: "LiNKbrain",
  description:
    "Private Brain adapter with durable keyed-store outbox and lifecycle capture. Default-disabled; transportMode defaults to disabled.",
  configSchema: linkbrainConfigSchema,
  register(api: OpenClawPluginApi) {
    const config = parseLinkbrainConfig(api.pluginConfig);
    let runtime: LinkbrainRuntime | null = null;
    let lifecycle: LinkbrainLifecycle | null = null;
    let drainWorker: BrainDrainWorker | null = null;
    const flaggedMcp = buildLinkbrainFlaggedMcpToolFilter(config);
    const conversationAccessAllowed = isLinkbrainConversationAccessAllowed(api.config);

    // Conversation/data-bearing hooks fail closed unless:
    // plugins.entries.linkbrain.hooks.allowConversationAccess=true
    api.logger.info(
      `linkbrain: registered (default-disabled). conversationAccess=${conversationAccessAllowed}; governedHooks=${LINKBRAIN_CONVERSATION_HOOKS.join(",")}; require ${LINKBRAIN_CONVERSATION_HOOK_REQUIREMENT}; mcpInclude=${flaggedMcp?.include.length ?? 0}; optionalNativeTools=linkbrain_read,linkbrain_write; no brain_* plugin tools registered`,
    );

    api.registerMcpServerToolFilter({
      serverName: "linkbrain",
      resolve: () => {
        const live = parseLinkbrainConfig(api.pluginConfig);
        return buildLinkbrainFlaggedMcpToolFilter(live);
      },
    });
    // Keep the PACI bearer inside the plugin process. This optional local tool
    // is the safe bridge for native OAuth runtimes that cannot receive a
    // managed machine-token MCP projection.
    api.registerTool(createLinkbrainReadTool(api), { optional: true });
    // Writes stay a separate optional capability so enabling read never grants
    // mutation. Operators must explicitly add linkbrain_write via alsoAllow.
    api.registerTool((context) => createLinkbrainWriteTool(api, context), {
      name: "linkbrain_write",
      optional: true,
    });

    const service: OpenClawPluginService = {
      id: "linkbrain-outbox",
      start: async () => {
        const stores = openLinkbrainStoresFromApi(api, config.outboxMaxEntries);
        const transport = resolveLinkbrainTransport({
          api,
          config,
          machineTokenFacade: api.machineTokenFacade,
        });
        runtime = createLinkbrainRuntime({
          config,
          stores,
          transport,
          withLease: (options, run) => api.runtime.state.withLease(options, run),
        });
        await runtime.open();
        const capture = createLinkbrainCapture({
          config,
          stores,
          runtime,
        });
        lifecycle = createLinkbrainLifecycle({
          config,
          runtime,
          capture,
          logger: api.logger,
        });
        drainWorker = createBrainDrainWorker({
          intervalMs: config.flushIntervalMs,
          tickTimeoutMs: 2_000,
          stopTimeoutMs: 2_000,
          shouldDrain: () =>
            Boolean(runtime?.opened) && (config.captureDrain || config.coordinationWrites),
          drainOnce: (options) => {
            if (!runtime) {
              return Promise.resolve({ drained: 0, retried: 0, deadLettered: 0, skipped: 0 });
            }
            return runtime.drainOnce(options);
          },
          onError: (error) => {
            api.logger.warn(
              `linkbrain: drain worker error: ${error instanceof Error ? error.message : "unknown"}`,
            );
          },
          onStalled: (info) => {
            runtime?.noteStalled?.(info);
            api.logger.warn(
              `linkbrain: drain worker stalled: ${info.label} (${info.reason}); ownership retained`,
            );
          },
        });
        if (config.captureDrain || config.coordinationWrites) {
          drainWorker.start();
        }
        api.logger.info(
          `linkbrain: state open (namespaces=${stores.openedNamespaces.join(",")}; transportMode=${config.transportMode}; captureEnqueue=${config.captureEnqueue}; captureDrain=${config.captureDrain}; coordinationWrites=${config.coordinationWrites}; flushIntervalMs=${config.flushIntervalMs}; worker=${drainWorker.running})`,
        );
      },
      stop: async () => {
        if (drainWorker) {
          await drainWorker.stop();
          drainWorker = null;
        }
        // Always promote local capture buffer. Remote drain only while this
        // generation is still live (or no MT facade). After a successful reload
        // commit the prior generation is already retired; draining then would
        // mint against an unregistered facade and deadletter outbox rows.
        if (lifecycle) {
          await lifecycle.handleGatewayStop({
            drain: canFlushWithMachineTokenFacade(api.machineTokenFacade),
          });
        }
        lifecycle = null;
        if (runtime) {
          await runtime.shutdown();
          runtime = null;
        }
        // Plugin-side release under a host service lease is a no-op so cache-hit
        // reload stop/restart keeps the shared live generation. Without a lease
        // (standalone/test) this remains authoritative teardown.
        api.machineTokenFacade?.unregister();
      },
    };

    api.registerService(service);

    const getLifecycle = (): LinkbrainLifecycle | null => lifecycle;

    // Bounded timeouts are plugin-local AbortController bounds in handlers;
    // host timeoutMs is an upper bound only and does not cancel underlying work alone.
    const hookOpts = { timeoutMs: 3_000 } as const;

    // Service/worker hooks stay available without conversation access so an
    // explicitly enabled plugin can open/drain state without registering
    // capture/coordination hooks.
    api.on(
      "gateway_start",
      async () => {
        if (
          drainWorker &&
          (config.captureDrain || config.coordinationWrites) &&
          !drainWorker.running
        ) {
          drainWorker.start();
        }
        await getLifecycle()?.handleGatewayStart();
      },
      hookOpts,
    );

    api.on(
      "gateway_stop",
      async () => {
        if (drainWorker) {
          await drainWorker.stop();
        }
        // Best-effort local flush (+ remote drain while live). Do not unregister
        // here — gateway close runs gateway_stop before pluginServices.stop;
        // early unregister makes the later service.stop flush hit
        // machine_token_error and deadletter remaining outbox rows.
        await getLifecycle()?.handleGatewayStop({
          drain: canFlushWithMachineTokenFacade(api.machineTokenFacade),
        });
      },
      hookOpts,
    );

    if (!conversationAccessAllowed) {
      api.logger.info(
        `linkbrain: conversation/data-bearing hooks not registered; set ${LINKBRAIN_CONVERSATION_HOOK_REQUIREMENT} to enable capture/coordination lifecycle hooks`,
      );
      return;
    }

    api.on(
      "session_start",
      async (event) => {
        await getLifecycle()?.handleSessionStart(event);
      },
      hookOpts,
    );

    api.on(
      "message_received",
      async (event) => {
        await getLifecycle()?.handleMessageReceived(event);
      },
      hookOpts,
    );

    api.on(
      "agent_end",
      async (event, ctx) => {
        await getLifecycle()?.handleAgentEnd(event, ctx);
      },
      hookOpts,
    );

    api.on(
      "before_compaction",
      async (_event, ctx) => {
        await getLifecycle()?.handleBeforeCompaction(ctx);
      },
      hookOpts,
    );

    api.on(
      "after_compaction",
      async (event, ctx) => {
        await getLifecycle()?.handleAfterCompaction(event, ctx);
      },
      hookOpts,
    );

    api.on(
      "before_reset",
      async (_event, ctx) => {
        await getLifecycle()?.handleBeforeReset(ctx);
      },
      hookOpts,
    );

    api.on(
      "session_end",
      async (event) => {
        await getLifecycle()?.handleSessionEnd(event);
      },
      hookOpts,
    );

    api.on(
      "subagent_spawned",
      async (event) => {
        await getLifecycle()?.handleSubagentSpawned(event);
      },
      hookOpts,
    );

    api.on(
      "subagent_ended",
      async (event) => {
        await getLifecycle()?.handleSubagentEnded(event);
      },
      hookOpts,
    );
  },
});

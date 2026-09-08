// Linkskills plugin entrypoint — default-disabled private Skills adapter.
// Never registers conversation/prompt/message-bearing hooks.
// Observes exact skills_* tools via after_tool_call only.
// Feature flags gate managed MCP allowlists — no plugin tools named skills_*.
import {
  definePluginEntry,
  type OpenClawPluginApi,
  type OpenClawPluginService,
} from "./runtime-api.js";
import { isOperationTimeout, runBounded } from "./src/bounded.js";
import { createSkillsTelemetryCollector } from "./src/collect.js";
import { linkskillsConfigSchema, parseLinkskillsConfig } from "./src/config.js";
import { createSkillsDrainWorker, type SkillsDrainWorker } from "./src/drain-worker.js";
import { buildLinkskillsFlaggedMcpToolFilter } from "./src/feature-flags.js";
import { LINKSKILLS_CONVERSATION_HOOK_POLICY, LINKSKILLS_PLUGIN_ID } from "./src/namespaces.js";
import { createLinkskillsTool } from "./src/oauth-tool.js";
import { createLinkskillsRuntime, type LinkskillsRuntime } from "./src/runtime.js";
import { openLinkskillsStoresFromApi } from "./src/stores.js";
import { resolveLinkskillsTransport } from "./src/transport.js";

/**
 * Whether stop/drain may safely attempt remote writes that need the injected
 * machine-token facade. No facade means no generation ownership — drain is OK.
 * A present but retired generation must not drain (retryable machine_token_error
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
  id: LINKSKILLS_PLUGIN_ID,
  name: "LiNKskills",
  description:
    "Private Skills adapter with durable keyed-store telemetry outbox. Default-disabled; no conversation hooks; transportMode defaults to disabled.",
  configSchema: linkskillsConfigSchema,
  register(api: OpenClawPluginApi) {
    const config = parseLinkskillsConfig(api.pluginConfig);
    let runtime: LinkskillsRuntime | null = null;
    let drainWorker: SkillsDrainWorker | null = null;
    const collector = createSkillsTelemetryCollector();
    const flaggedMcp = buildLinkskillsFlaggedMcpToolFilter(config);

    api.logger.info(
      `linkskills: registered (default-disabled plugin). ${LINKSKILLS_CONVERSATION_HOOK_POLICY}; mcpInclude=${flaggedMcp?.include.length ?? 0}; no skills_* plugin tools registered`,
    );

    api.registerMcpServerToolFilter({
      serverName: "linkskills",
      resolve: () => {
        const live = parseLinkskillsConfig(api.pluginConfig);
        return buildLinkskillsFlaggedMcpToolFilter(live);
      },
    });
    // Keep PACI credentials inside the plugin process for native OAuth models.
    api.registerTool(createLinkskillsTool(api), { optional: true });

    const service: OpenClawPluginService = {
      id: "linkskills-outbox",
      start: async () => {
        const stores = openLinkskillsStoresFromApi(api, config.outboxMaxEntries);
        const transport = resolveLinkskillsTransport({
          api,
          config,
          machineTokenFacade: api.machineTokenFacade,
        });
        runtime = createLinkskillsRuntime({
          config,
          stores,
          transport,
          withLease: (options, run) => api.runtime.state.withLease(options, run),
        });
        await runtime.open();
        drainWorker = createSkillsDrainWorker({
          intervalMs: config.flushIntervalMs,
          tickTimeoutMs: 2_000,
          stopTimeoutMs: 2_000,
          shouldDrain: () => Boolean(runtime?.opened) && config.telemetryDrain,
          drainOnce: (options) => {
            if (!runtime) {
              return Promise.resolve({ drained: 0, retried: 0, deadLettered: 0, skipped: 0 });
            }
            return runtime.drainOnce(options);
          },
          onError: (error) => {
            api.logger.warn(
              `linkskills: drain worker error: ${error instanceof Error ? error.message : "unknown"}`,
            );
          },
          onStalled: (info) => {
            runtime?.noteStalled(info);
            api.logger.warn(
              `linkskills: drain worker stalled: ${info.label} (${info.reason}); ownership retained`,
            );
          },
        });
        if (config.telemetryDrain) {
          drainWorker.start();
        }
        api.logger.info(
          `linkskills: state open (namespaces=${stores.openedNamespaces.join(",")}; transportMode=${config.transportMode}; telemetryEnqueue=${config.telemetryEnqueue}; telemetryDrain=${config.telemetryDrain}; flushIntervalMs=${config.flushIntervalMs}; worker=${drainWorker.running})`,
        );
      },
      stop: async () => {
        if (drainWorker) {
          await drainWorker.stop();
          drainWorker = null;
        }
        // Drain only while this generation is still live. After a successful
        // reload commit the prior generation is already retired; draining then
        // would mint against an unregistered facade and deadletter outbox rows.
        if (
          runtime &&
          config.telemetryDrain &&
          canFlushWithMachineTokenFacade(api.machineTokenFacade)
        ) {
          try {
            await runBounded(
              async (signal) => {
                await runtime!.drainOnce({ signal });
              },
              { timeoutMs: 2_000, label: "service_stop_drain" },
            );
          } catch {
            // Bound exceeded — durable outbox retained for the next live facade.
          }
        }
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

    const hookOpts = { timeoutMs: 3_000 } as const;

    api.on(
      "after_tool_call",
      async (event, ctx) => {
        if (!runtime?.opened || !config.telemetryEnqueue) {
          return;
        }
        const observed = collector.observe({
          toolName: event.toolName,
          params: event.params,
          result: event.result,
          error: event.error,
          durationMs: event.durationMs,
          runId: event.runId ?? ctx.runId,
          toolCallId: event.toolCallId ?? ctx.toolCallId,
          agentId: ctx.agentId,
          sessionKey: ctx.sessionKey,
          sessionId: ctx.sessionId,
        });
        if (!observed) {
          return;
        }
        try {
          await runBounded(
            async (signal) => {
              throwIfRuntimeMissing(runtime);
              await runtime!.enqueueTelemetry({
                toolName: observed.toolName,
                idempotencyKey: observed.idempotencyKey,
                body: observed.body,
                signal,
              });
            },
            {
              timeoutMs: 2_000,
              label: "skills-telemetry-enqueue",
              onStalled: (info) => {
                runtime?.noteStalled(info);
                api.logger.warn(
                  `linkskills: ${info.label} stalled (${info.reason}); exclusive enqueue ownership retained`,
                );
              },
            },
          );
        } catch (error) {
          if (isOperationTimeout(error)) {
            return;
          }
          api.logger.warn(
            `linkskills: telemetry enqueue failed: ${error instanceof Error ? error.message : "unknown"}`,
          );
        }
      },
      hookOpts,
    );

    api.on(
      "gateway_start",
      async () => {
        api.logger.info("linkskills: gateway_start observed");
        if (drainWorker && config.telemetryDrain && !drainWorker.running) {
          drainWorker.start();
        }
        if (runtime && config.telemetryDrain) {
          try {
            await runBounded(
              async (signal) => {
                await runtime!.drainOnce({ signal });
              },
              { timeoutMs: 2_000, label: "gateway_start_drain" },
            );
          } catch {
            // Bound exceeded — durable outbox retained.
          }
        }
      },
      hookOpts,
    );

    api.on(
      "gateway_stop",
      async () => {
        api.logger.info("linkskills: gateway_stop observed");
        if (drainWorker) {
          await drainWorker.stop();
        }
        // Best-effort drain while the facade is still live. Do not unregister
        // here — gateway close runs gateway_stop before pluginServices.stop;
        // early unregister makes the later service.stop drain hit
        // machine_token_error and deadletter remaining outbox rows.
        if (
          runtime &&
          config.telemetryDrain &&
          canFlushWithMachineTokenFacade(api.machineTokenFacade)
        ) {
          try {
            await runBounded(
              async (signal) => {
                await runtime!.drainOnce({ signal });
              },
              { timeoutMs: 2_000, label: "gateway_stop_drain" },
            );
          } catch {
            // Bound exceeded — durable outbox retained.
          }
        }
      },
      hookOpts,
    );
  },
});

function throwIfRuntimeMissing(
  runtime: LinkskillsRuntime | null,
): asserts runtime is LinkskillsRuntime {
  if (!runtime) {
    throw new Error("linkskills: runtime not open");
  }
}

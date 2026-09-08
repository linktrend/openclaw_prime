/**
 * Plan §10.1 lifecycle → Brain capture/coordination mapping.
 *
 * Conversation/data-bearing hooks fail closed unless operators set:
 *   plugins.entries.linkbrain.hooks.allowConversationAccess=true
 *
 * Service/worker hooks (`gateway_start`, `gateway_stop`) may register without
 * that gate so harmless outbox startup remains available when the plugin is
 * explicitly enabled.
 *
 * Handlers never throw uncaught; Brain failures degrade honestly and preserve
 * native OpenClaw compaction/reset/delivery/memory behavior.
 */
import { isOperationTimeout, runBounded } from "./bounded.js";
import type { LinkbrainCapture } from "./capture.js";
import { captureFingerprint } from "./capture.js";
import type { LinkbrainConfig } from "./config.js";
import { LINKBRAIN_CONVERSATION_HOOK_REQUIREMENT } from "./namespaces.js";
import { opaqueId } from "./opaque.js";
import type { LinkbrainRuntime } from "./runtime.js";
import { sanitizeCaptureText, stripUnsafeFields } from "./sanitize.js";
import { LINKBRAIN_CHECKPOINT_TOOL, LINKBRAIN_TASK_UPDATE_TOOL } from "./tools.js";

/** Harmless service/worker hooks that do not require conversation access. */
export const LINKBRAIN_SERVICE_HOOKS = Object.freeze(["gateway_start", "gateway_stop"] as const);

/**
 * Conversation/data-bearing §10.1 hooks. These can access or derive conversation
 * content and must not register unless allowConversationAccess===true.
 */
export const LINKBRAIN_CONVERSATION_HOOKS = Object.freeze([
  "session_start",
  "message_received",
  "agent_end",
  "before_compaction",
  "after_compaction",
  "before_reset",
  "session_end",
  "subagent_spawned",
  "subagent_ended",
] as const);

export const LINKBRAIN_REGISTERED_HOOKS = Object.freeze([
  ...LINKBRAIN_CONVERSATION_HOOKS,
  ...LINKBRAIN_SERVICE_HOOKS,
] as const);

type LinkbrainRegisteredHook = (typeof LINKBRAIN_REGISTERED_HOOKS)[number];

/** True only when the operator explicitly opts into Brain conversation hooks. */
export function isLinkbrainConversationAccessAllowed(config: {
  plugins?: {
    entries?: Record<string, { hooks?: { allowConversationAccess?: boolean } } | undefined>;
  };
}): boolean {
  return config.plugins?.entries?.linkbrain?.hooks?.allowConversationAccess === true;
}

type LifecycleLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

type SessionContextRecord = {
  version: 1;
  sessionId: string;
  bindingId?: string;
  actorId?: string;
  openedAtMs: number;
  updatedAtMs: number;
};

export type LinkbrainLifecycle = {
  readonly registeredHooks: readonly LinkbrainRegisteredHook[];
  readonly conversationHookRequirement: string;
  handleSessionStart(event: { sessionId: string; sessionKey?: string }): Promise<void>;
  handleMessageReceived(event: {
    content?: string;
    messageId?: string;
    sessionKey?: string;
    runId?: string;
    senderId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  handleAgentEnd(
    event: {
      runId?: string;
      success: boolean;
      error?: string;
      durationMs?: number;
      messages?: unknown[];
    },
    ctx: { sessionKey?: string; sessionId?: string; agentId?: string; runId?: string },
  ): Promise<void>;
  handleBeforeCompaction(ctx: {
    sessionKey?: string;
    sessionId?: string;
    runId?: string;
  }): Promise<void>;
  handleAfterCompaction(
    event: {
      messageCount: number;
      compactedCount: number;
      tokenCount?: number;
      previousSessionId?: string;
    },
    ctx: { sessionKey?: string; sessionId?: string },
  ): Promise<void>;
  handleBeforeReset(ctx: { sessionKey?: string; sessionId?: string }): Promise<void>;
  handleSessionEnd(event: {
    sessionId: string;
    sessionKey?: string;
    reason?: string;
  }): Promise<void>;
  handleGatewayStart(): Promise<void>;
  /**
   * Promote local capture buffer to outbox, then optionally remote-drain.
   * Pass `drain: false` when the closed-over machine-token generation is already
   * retired (reload commit) so local flush still runs without minting.
   */
  handleGatewayStop(options?: { drain?: boolean }): Promise<void>;
  handleSubagentSpawned(event: {
    runId: string;
    childSessionKey: string;
    agentId?: string;
    requester?: { channel?: string };
  }): Promise<void>;
  handleSubagentEnded(event: {
    targetSessionKey: string;
    runId?: string;
    outcome?: string;
    reason?: string;
  }): Promise<void>;
};

type CreateLinkbrainLifecycleParams = {
  config: LinkbrainConfig;
  runtime: LinkbrainRuntime;
  capture: LinkbrainCapture;
  logger?: LifecycleLogger;
  now?: () => number;
  operationTimeoutMs?: number;
  /** In-memory session bookkeeping (local only; opaque ids). */
  sessionContexts?: Map<string, SessionContextRecord>;
};

async function safe(
  label: string,
  logger: LifecycleLogger | undefined,
  work: () => Promise<void>,
): Promise<void> {
  try {
    await work();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const prefix = isOperationTimeout(error) ? "stalled" : "degraded";
    logger?.warn(`linkbrain: ${label} ${prefix}: ${message}`);
  }
}

function streamKeyFrom(parts: { sessionKey?: string; sessionId?: string; runId?: string }): string {
  return parts.sessionKey || parts.sessionId || parts.runId || "anonymous";
}

/** Extract a short assistant outcome without forwarding prompt/CoT/message dumps. */
function assistantOutcomeText(event: {
  success: boolean;
  error?: string;
  durationMs?: number;
  messages?: unknown[];
}): string {
  // Intentionally ignore event.messages — may contain reasoning/prompt bodies.
  void event.messages;
  const status = event.success ? "ok" : "error";
  const duration =
    typeof event.durationMs === "number" && Number.isFinite(event.durationMs)
      ? ` durationMs=${Math.round(event.durationMs)}`
      : "";
  const err =
    !event.success && typeof event.error === "string" && event.error.length > 0
      ? ` error=${sanitizeCaptureText(event.error, 240)}`
      : "";
  return sanitizeCaptureText(`assistant_outcome status=${status}${duration}${err}`);
}

export function createLinkbrainLifecycle(
  params: CreateLinkbrainLifecycleParams,
): LinkbrainLifecycle {
  const now = params.now ?? (() => Date.now());
  const operationTimeoutMs = params.operationTimeoutMs ?? 2_000;
  const sessions = params.sessionContexts ?? new Map<string, SessionContextRecord>();
  const logger = params.logger;

  const enqueueCoordination = async (input: {
    toolName: typeof LINKBRAIN_CHECKPOINT_TOOL | typeof LINKBRAIN_TASK_UPDATE_TOOL;
    idempotencyKey: string;
    body: Record<string, unknown>;
  }) => {
    if (!params.config.coordinationWrites) {
      return;
    }
    const cleaned = stripUnsafeFields(input.body);
    try {
      await runBounded(
        async (signal) => {
          await params.runtime.enqueueWrite({
            kind: "coordination",
            toolName: input.toolName,
            idempotencyKey: input.idempotencyKey,
            body: cleaned as Record<string, unknown>,
            signal,
          });
        },
        {
          timeoutMs: operationTimeoutMs,
          label: "coordination-enqueue",
          onStalled: (info) => {
            params.runtime.noteStalled?.(info);
            logger?.warn(
              `linkbrain: ${info.label} stalled: ${info.reason} (mutation ownership retained)`,
            );
          },
        },
      );
    } catch (error) {
      if (isOperationTimeout(error)) {
        return;
      }
      throw error;
    }
  };

  const drainBounded = async (label: string) => {
    if (!params.config.captureDrain && !params.config.coordinationWrites) {
      return;
    }
    await runBounded(
      async (signal) => {
        await params.runtime.drainOnce({ signal });
      },
      {
        timeoutMs: operationTimeoutMs,
        label,
        onStalled: (info) => {
          params.runtime.noteStalled?.(info);
          logger?.warn(
            `linkbrain: ${info.label} stalled: ${info.reason} (drain may still hold exclusive ownership)`,
          );
        },
      },
    );
  };

  return {
    registeredHooks: LINKBRAIN_REGISTERED_HOOKS,
    conversationHookRequirement: LINKBRAIN_CONVERSATION_HOOK_REQUIREMENT,

    async handleSessionStart(event) {
      await safe("session_start", logger, async () => {
        const sessionId = opaqueId("session", event.sessionId || event.sessionKey);
        const bindingId = event.sessionKey ? opaqueId("binding", event.sessionKey) : undefined;
        sessions.set(sessionId, {
          version: 1,
          sessionId,
          ...(bindingId ? { bindingId } : {}),
          openedAtMs: now(),
          updatedAtMs: now(),
        });
        logger?.info(`linkbrain: session_start attached ${sessionId}`);
      });
    },

    async handleMessageReceived(event) {
      await safe("message_received", logger, async () => {
        // Drop attachment/prompt-bearing metadata; content text only after sanitize.
        void stripUnsafeFields(event.metadata ?? {});
        const text = typeof event.content === "string" ? event.content : "";
        if (!text) {
          return;
        }
        const streamKey = streamKeyFrom({
          sessionKey: event.sessionKey,
          runId: event.runId,
        });
        await params.capture.enqueue({
          streamKey,
          actorKey: event.senderId,
          role: "user",
          text,
          fingerprint: captureFingerprint([event.messageId, event.sessionKey, event.runId, "user"]),
        });
      });
    },

    async handleAgentEnd(event, ctx) {
      await safe("agent_end", logger, async () => {
        const streamKey = streamKeyFrom({
          sessionKey: ctx.sessionKey,
          sessionId: ctx.sessionId,
          runId: event.runId ?? ctx.runId,
        });
        await params.capture.enqueue({
          streamKey,
          actorKey: ctx.agentId,
          role: "assistant",
          text: assistantOutcomeText(event),
          fingerprint: captureFingerprint([
            event.runId ?? ctx.runId,
            ctx.sessionKey,
            "agent_end",
            String(event.success),
          ]),
        });
        // Do not unbounded-flush remotely here — only local enqueue.
      });
    },

    async handleBeforeCompaction(ctx) {
      await safe("before_compaction", logger, async () => {
        const streamKey = streamKeyFrom(ctx);
        await params.capture.flush(streamKey, "before_compaction");
        const taskId = opaqueId("task", `${streamKey}:compaction`);
        await enqueueCoordination({
          toolName: LINKBRAIN_CHECKPOINT_TOOL,
          idempotencyKey: `chk:compaction:${opaqueId("session", streamKey)}`,
          body: {
            taskId,
            summary: "before_compaction boundary",
            sessionId: opaqueId("session", streamKey),
            runId: ctx.runId ? opaqueId("run", ctx.runId) : undefined,
            decisions: ["flush_capture_buffer"],
            nextActions: ["await_after_compaction"],
          },
        });
      });
    },

    async handleAfterCompaction(event, ctx) {
      await safe("after_compaction", logger, async () => {
        const streamKey = streamKeyFrom(ctx);
        await enqueueCoordination({
          toolName: LINKBRAIN_CHECKPOINT_TOOL,
          idempotencyKey: `chk:after_compaction:${opaqueId("session", streamKey)}:${event.compactedCount}`,
          body: {
            taskId: opaqueId("task", `${streamKey}:after_compaction`),
            summary: "after_compaction metadata",
            sessionId: opaqueId("session", streamKey),
            messageCount: event.messageCount,
            compactedCount: event.compactedCount,
            ...(typeof event.tokenCount === "number" ? { tokenCount: event.tokenCount } : {}),
            ...(event.previousSessionId
              ? { previousSessionId: opaqueId("session", event.previousSessionId) }
              : {}),
          },
        });
      });
    },

    async handleBeforeReset(ctx) {
      await safe("before_reset", logger, async () => {
        const streamKey = streamKeyFrom(ctx);
        await params.capture.flush(streamKey, "before_reset");
        const sessionId = opaqueId("session", streamKey);
        sessions.delete(sessionId);
        await enqueueCoordination({
          toolName: LINKBRAIN_CHECKPOINT_TOOL,
          idempotencyKey: `chk:reset:${sessionId}`,
          body: {
            taskId: opaqueId("task", `${streamKey}:reset`),
            summary: "before_reset boundary",
            sessionId,
            decisions: ["flush_and_close_subordinate_context"],
          },
        });
      });
    },

    async handleSessionEnd(event) {
      await safe("session_end", logger, async () => {
        const streamKey = event.sessionKey || event.sessionId;
        await params.capture.flush(streamKey, "session_end");
        const sessionId = opaqueId("session", event.sessionId || event.sessionKey);
        sessions.delete(sessionId);
      });
    },

    async handleGatewayStart() {
      await safe("gateway_start", logger, async () => {
        logger?.info(
          `linkbrain: gateway_start; conversation hooks require ${LINKBRAIN_CONVERSATION_HOOK_REQUIREMENT}`,
        );
        await drainBounded("gateway_start_drain");
      });
    },

    async handleGatewayStop(options) {
      const shouldDrain = options?.drain !== false;
      await safe("gateway_stop", logger, async () => {
        // Overall wall-clock for flush+drain; abandoned stream work retains locks.
        try {
          await runBounded(
            async (signal) => {
              await params.capture.flushAll("gateway_stop", { signal });
              if (signal.aborted || !shouldDrain) {
                return;
              }
              await drainBounded("gateway_stop_drain");
            },
            {
              timeoutMs: Math.max(operationTimeoutMs, 5_000),
              label: "gateway_stop",
              onStalled: (info) => {
                params.runtime.noteStalled?.(info);
                logger?.warn(
                  `linkbrain: ${info.label} stalled: ${info.reason}; durable outbox retained`,
                );
              },
            },
          );
        } catch (error) {
          if (!isOperationTimeout(error)) {
            throw error;
          }
        }
      });
    },

    async handleSubagentSpawned(event) {
      await safe("subagent_spawned", logger, async () => {
        await enqueueCoordination({
          toolName: LINKBRAIN_TASK_UPDATE_TOOL,
          idempotencyKey: `subagent:start:${opaqueId("run", event.runId)}`,
          body: {
            taskId: opaqueId("task", event.runId),
            status: "active",
            note: "subagent_spawned",
            childSessionId: opaqueId("subagent", event.childSessionKey),
            runId: opaqueId("run", event.runId),
            ...(event.agentId ? { actorId: opaqueId("actor", event.agentId) } : {}),
          },
        });
      });
    },

    async handleSubagentEnded(event) {
      await safe("subagent_ended", logger, async () => {
        const runMaterial = event.runId || event.targetSessionKey;
        await enqueueCoordination({
          toolName: LINKBRAIN_TASK_UPDATE_TOOL,
          idempotencyKey: `subagent:end:${opaqueId("run", runMaterial)}:${event.outcome ?? "unknown"}`,
          body: {
            taskId: opaqueId("task", runMaterial),
            status: event.outcome === "ok" ? "done" : "failed",
            note: "subagent_ended",
            childSessionId: opaqueId("subagent", event.targetSessionKey),
            ...(event.runId ? { runId: opaqueId("run", event.runId) } : {}),
            ...(event.reason ? { reason: sanitizeCaptureText(event.reason, 120) } : {}),
          },
        });
      });
    },
  };
}

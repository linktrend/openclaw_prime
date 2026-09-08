import {
  LINKBRAIN_MCP_MANAGED_TOOL_ALLOWLIST,
  isAllowedLinkbrainMcpTool,
} from "../mcp-tool-filter.js";
/**
 * Feature flags for Brain — managed MCP allowlist gating + fake/MCP delegation.
 *
 * Does **not** register plugin tools named `brain_*` (avoids MCP naming conflicts).
 * Flags gate which §9.1 tools appear via `api.registerMcpServerToolFilter` (config ∩
 * plugin overlay at catalog materialization) and which ops the plugin may invoke
 * through the injectable transport/public surface.
 *
 * Empty include after flags is returned as `null` (deny-all / omit). Never return
 * `{ include: [] }` — empty include means unrestricted in OpenClaw materialize.
 */
import type { LinkbrainConfig } from "./config.js";
import { BRAIN_V2_OPERATIONS } from "./v2-pins.js";

export const LINKBRAIN_MCP_READ_TOOLS = Object.freeze([
  "brain_browse",
  "brain_search",
  "brain_load",
  "brain_append_finding",
  "brain_private_search",
  "brain_private_load",
  "brain_inbox_read",
  "v2.discovery",
  "v2.capability.status",
  "v2.projection.list",
  "v2.projection.get",
  "v2.projection.evidence",
  "v2.task.get",
  "v2.task.list",
  "v2.inbox.read",
  "v2.event.poll",
  "v2.knowledge.search",
  "v2.knowledge.browse",
  "v2.knowledge.load",
] as const);

/** Capture enqueue family — gated by `captureEnqueue`. */
export const LINKBRAIN_MCP_CAPTURE_ENQUEUE_TOOLS = Object.freeze([
  "brain_capture_batch",
  "brain_episode_checkpoint",
] as const);

/**
 * Capture drain has no dedicated §9.1 MCP tool surface; the flag gates the
 * drain worker / runtime path only. Listed for completeness of flag→surface map.
 */
export const LINKBRAIN_MCP_CAPTURE_DRAIN_TOOLS = Object.freeze([] as const);

/** Coordination write family — gated by `coordinationWrites` (inbox_read stays mcpRead). */
export const LINKBRAIN_MCP_COORDINATION_WRITE_TOOLS = Object.freeze([
  "brain_task_start",
  "brain_task_update",
  "brain_conflict_respond",
  "brain_message_send",
  "brain_checkpoint_write",
  "brain_handoff_create",
  "brain_handoff_accept",
  "brain_task_close",
  "v2.projection.ingest",
  "v2.message.send",
  "v2.checkpoint.write",
  "v2.handoff.create",
  "v2.handoff.accept",
  "v2.conflict.report",
  "v2.event.ack",
  "v2.finding.submit",
] as const);

type LinkbrainReadTool = (typeof LINKBRAIN_MCP_READ_TOOLS)[number];

const readSet = new Set<string>(LINKBRAIN_MCP_READ_TOOLS);
const captureEnqueueSet = new Set<string>(LINKBRAIN_MCP_CAPTURE_ENQUEUE_TOOLS);
const coordinationWriteSet = new Set<string>(LINKBRAIN_MCP_COORDINATION_WRITE_TOOLS);

if (
  BRAIN_V2_OPERATIONS.some(
    (operation) =>
      !readSet.has(operation) &&
      !captureEnqueueSet.has(operation) &&
      !coordinationWriteSet.has(operation),
  )
) {
  throw new Error("linkbrain: unclassified v2 MCP operation");
}

export function isLinkbrainReadTool(toolName: string): toolName is LinkbrainReadTool {
  return readSet.has(toolName);
}

export function isLinkbrainCaptureEnqueueTool(toolName: string): boolean {
  return captureEnqueueSet.has(toolName);
}

export function isLinkbrainCoordinationWriteTool(toolName: string): boolean {
  return coordinationWriteSet.has(toolName);
}

/**
 * Builds the managed MCP include list after applying independent Brain flags.
 * Returns `null` when no tools remain (deny-all / omit) — never `{ include: [] }`.
 *
 * `captureDrain` has no MCP tool names; it still participates in the all-false
 * proof by not exposing any drain-shaped tools (none exist) while runtime gates
 * the worker separately.
 */
export function buildLinkbrainFlaggedMcpToolFilter(
  config: Pick<
    LinkbrainConfig,
    "mcpRead" | "captureEnqueue" | "captureDrain" | "coordinationWrites"
  >,
): { include: string[] } | null {
  void config.captureDrain;
  const include = LINKBRAIN_MCP_MANAGED_TOOL_ALLOWLIST.filter((name) => {
    if (isLinkbrainReadTool(name)) {
      return config.mcpRead;
    }
    if (isLinkbrainCaptureEnqueueTool(name)) {
      return config.captureEnqueue;
    }
    if (isLinkbrainCoordinationWriteTool(name)) {
      return config.coordinationWrites;
    }
    return false;
  });
  if (include.length === 0) {
    return null;
  }
  // Mutable copy — McpServerToolFilterResolved.include is string[], not readonly.
  return { include: [...include] };
}

export type BrainFeatureInvokeResult = {
  ok: boolean;
  errorCode?: string;
  safeMessage?: string;
  result?: Record<string, unknown>;
};

export type BrainFeatureTransport = {
  write(params: {
    toolName: string;
    idempotencyKey: string;
    arguments: Record<string, unknown>;
    signal?: AbortSignal;
  }): Promise<{
    ok: boolean;
    errorCode?: string;
    safeMessage?: string;
    result?: Record<string, unknown>;
  }>;
};

/**
 * Invokes a Brain domain op through the configured transport when the matching
 * feature flag is on and transportMode is not disabled. Direct managed-MCP
 * exposure must not bypass these runtime checks.
 */
export async function invokeLinkbrainFeatureRead(params: {
  config: Pick<
    LinkbrainConfig,
    "mcpRead" | "captureEnqueue" | "captureDrain" | "coordinationWrites" | "transportMode"
  >;
  transport: BrainFeatureTransport;
  toolName: string;
  arguments?: Record<string, unknown>;
  idempotencyKey: string;
  signal?: AbortSignal;
}): Promise<BrainFeatureInvokeResult> {
  if (params.config.transportMode === "disabled") {
    return {
      ok: false,
      errorCode: "transport_disabled",
      safeMessage: "transportMode is disabled",
    };
  }
  if (!isAllowedLinkbrainMcpTool(params.toolName)) {
    return {
      ok: false,
      errorCode: "tool_not_allowlisted",
      safeMessage: `tool "${params.toolName}" is not on the §9.1 allowlist`,
    };
  }
  if (isLinkbrainReadTool(params.toolName) && !params.config.mcpRead) {
    return {
      ok: false,
      errorCode: "feature_flag_disabled",
      safeMessage: "mcpRead is disabled",
    };
  }
  if (isLinkbrainCaptureEnqueueTool(params.toolName) && !params.config.captureEnqueue) {
    return {
      ok: false,
      errorCode: "feature_flag_disabled",
      safeMessage: "captureEnqueue is disabled",
    };
  }
  if (isLinkbrainCoordinationWriteTool(params.toolName) && !params.config.coordinationWrites) {
    return {
      ok: false,
      errorCode: "feature_flag_disabled",
      safeMessage: "coordinationWrites is disabled",
    };
  }
  const outcome = await params.transport.write({
    toolName: params.toolName,
    idempotencyKey: params.idempotencyKey,
    arguments: params.arguments ?? {},
    signal: params.signal,
  });
  return {
    ok: outcome.ok,
    ...(outcome.errorCode ? { errorCode: outcome.errorCode } : {}),
    ...(outcome.safeMessage ? { safeMessage: outcome.safeMessage } : {}),
    ...(outcome.result ? { result: outcome.result } : {}),
  };
}

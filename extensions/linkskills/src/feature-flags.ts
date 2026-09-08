import {
  LINKSKILLS_MCP_MANAGED_TOOL_ALLOWLIST,
  LINKSKILLS_MCP_TOOL_ALLOWLIST,
  LINKSKILLS_MCP_V2_TOOLS,
  isAllowedLinkskillsMcpTool,
} from "../mcp-tool-filter.js";
/**
 * Feature flags for Skills — managed MCP allowlist gating + fake/MCP delegation.
 *
 * Does **not** register plugin tools named `skills_*` (avoids MCP naming conflicts).
 * Flags gate which §9.2 tools appear via `api.registerMcpServerToolFilter` (config ∩
 * plugin overlay at catalog materialization) and which ops may invoke transport.
 *
 * Empty include after flags is returned as `null` (deny-all / omit). Never return
 * `{ include: [] }` — empty include means unrestricted in OpenClaw materialize.
 */
import type { LinkskillsConfig } from "./config.js";
import {
  SKILLS_V2_OPERATIONS,
  SKILLS_V2_RESOURCE_OPERATIONS,
  SKILLS_V2_TOOL_OPERATIONS,
} from "./v2.js";

export const LINKSKILLS_MCP_DISCOVERY_TOOLS = Object.freeze([
  ...SKILLS_V2_RESOURCE_OPERATIONS,
  "skills_list",
  "skills_search",
  "skills_describe",
  "skills_fragment_get",
  "skills_release_get",
] as const);

export const LINKSKILLS_MCP_EXECUTION_TOOLS = Object.freeze([
  ...SKILLS_V2_TOOL_OPERATIONS.filter((name) => name !== "skills_feedback_submit"),
  "skills_run_start",
  "skills_run_update",
  "skills_run_complete",
  "skills_run_fail",
  "skills_tool_resolve",
  "skills_tool_invoke",
  "skills_input_validate",
  "skills_output_validate",
] as const);

/** Telemetry enqueue / evidence family — gated by `telemetryEnqueue`. */
export const LINKSKILLS_MCP_TELEMETRY_ENQUEUE_TOOLS = Object.freeze([
  "skills_feedback_submit",
  "skills_trace_candidate_submit",
] as const);

/**
 * Telemetry drain has no dedicated §9.2 MCP tool surface; the flag gates the
 * drain worker / runtime path only.
 */
export const LINKSKILLS_MCP_TELEMETRY_DRAIN_TOOLS = Object.freeze([] as const);

const discoverySet = new Set<string>(LINKSKILLS_MCP_DISCOVERY_TOOLS);
const executionSet = new Set<string>(LINKSKILLS_MCP_EXECUTION_TOOLS);
const telemetryEnqueueSet = new Set<string>(LINKSKILLS_MCP_TELEMETRY_ENQUEUE_TOOLS);
const v2TelemetryEnqueueSet = new Set<string>(["skills_feedback_submit"]);
const v2OperationSet = new Set<string>(SKILLS_V2_OPERATIONS);

if (
  SKILLS_V2_OPERATIONS.some(
    (operation) =>
      !discoverySet.has(operation) &&
      !executionSet.has(operation) &&
      !v2TelemetryEnqueueSet.has(operation),
  )
) {
  throw new Error("linkskills: unclassified v2 MCP operation");
}

export function isLinkskillsDiscoveryTool(toolName: string): boolean {
  return discoverySet.has(toolName);
}

export function isLinkskillsExecutionTool(toolName: string): boolean {
  return executionSet.has(toolName);
}

export function isLinkskillsTelemetryEnqueueTool(toolName: string): boolean {
  return telemetryEnqueueSet.has(toolName);
}

/**
 * Builds the managed MCP include list after applying Skills feature flags.
 * Returns `null` when no tools remain (deny-all / omit) — never `{ include: [] }`.
 */
export function buildLinkskillsFlaggedMcpToolFilter(
  config: Pick<
    LinkskillsConfig,
    "mcpDiscoveryRead" | "governedExecution" | "telemetryEnqueue" | "telemetryDrain"
  >,
  options: { includeLegacyCompatibility?: boolean } = {},
): { include: string[] } | null {
  void config.telemetryDrain;
  const allowlist = options.includeLegacyCompatibility
    ? Array.from(new Set([...LINKSKILLS_MCP_TOOL_ALLOWLIST, ...LINKSKILLS_MCP_V2_TOOLS]))
    : LINKSKILLS_MCP_MANAGED_TOOL_ALLOWLIST;
  const include = allowlist.filter((name) => {
    if (isLinkskillsDiscoveryTool(name)) {
      return config.mcpDiscoveryRead;
    }
    if (isLinkskillsExecutionTool(name)) {
      return config.governedExecution;
    }
    if (isLinkskillsTelemetryEnqueueTool(name)) {
      return config.telemetryEnqueue;
    }
    return false;
  });
  if (include.length === 0) {
    return null;
  }
  // Mutable copy — McpServerToolFilterResolved.include is string[], not readonly.
  return { include: [...include] };
}

export type SkillsFeatureInvokeResult = {
  ok: boolean;
  errorCode?: string;
  safeMessage?: string;
  result?: Record<string, unknown>;
};

export type SkillsFeatureTransport = {
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
 * Invokes a Skills domain op through transport when the matching flag is on and
 * transportMode is not disabled. Direct managed-MCP exposure must not bypass
 * these runtime checks.
 */
export async function invokeLinkskillsFeatureOp(params: {
  config: Pick<
    LinkskillsConfig,
    | "mcpDiscoveryRead"
    | "governedExecution"
    | "telemetryEnqueue"
    | "telemetryDrain"
    | "transportMode"
  >;
  transport: SkillsFeatureTransport;
  toolName: string;
  includeLegacyCompatibility?: boolean;
  arguments?: Record<string, unknown>;
  idempotencyKey: string;
  signal?: AbortSignal;
}): Promise<SkillsFeatureInvokeResult> {
  if (params.config.transportMode === "disabled") {
    return {
      ok: false,
      errorCode: "transport_disabled",
      safeMessage: "transportMode is disabled",
    };
  }
  if (
    !isAllowedLinkskillsMcpTool(params.toolName) ||
    (!v2OperationSet.has(params.toolName) && params.includeLegacyCompatibility !== true)
  ) {
    return {
      ok: false,
      errorCode: "tool_not_allowlisted",
      safeMessage: `tool "${params.toolName}" is not on the §9.2 allowlist`,
    };
  }
  if (isLinkskillsDiscoveryTool(params.toolName) && !params.config.mcpDiscoveryRead) {
    return {
      ok: false,
      errorCode: "feature_flag_disabled",
      safeMessage: "mcpDiscoveryRead is disabled",
    };
  }
  if (isLinkskillsExecutionTool(params.toolName) && !params.config.governedExecution) {
    return {
      ok: false,
      errorCode: "feature_flag_disabled",
      safeMessage: "governedExecution is disabled",
    };
  }
  if (isLinkskillsTelemetryEnqueueTool(params.toolName) && !params.config.telemetryEnqueue) {
    return {
      ok: false,
      errorCode: "feature_flag_disabled",
      safeMessage: "telemetryEnqueue is disabled",
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

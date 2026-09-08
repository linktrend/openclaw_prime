/**
 * Managed MCP toolFilter allowlist for `mcp.servers.linkskills` (plan §9.2).
 *
 * When `toolFilter.include` is set, OpenClaw default-denies any tool not matched.
 * This module is the Skills-only source of truth for that include list.
 * It does not import Brain symbols and must not be merged with linkbrain.
 */

import { SKILLS_V2_OPERATIONS } from "./src/v2.js";

/** Discovery family (§9.2). */
const LINKSKILLS_MCP_DISCOVERY_TOOLS = Object.freeze([
  "skills_list",
  "skills_search",
  "skills_describe",
  "skills_fragment_get",
  "skills_release_get",
] as const);

/** Runs family (§9.2). */
const LINKSKILLS_MCP_RUN_TOOLS = Object.freeze([
  "skills_run_start",
  "skills_run_update",
  "skills_run_complete",
  "skills_run_fail",
] as const);

/** Tool mediation family (§9.2). */
const LINKSKILLS_MCP_MEDIATION_TOOLS = Object.freeze([
  "skills_tool_resolve",
  "skills_tool_invoke",
] as const);

/** Validation family (§9.2). */
const LINKSKILLS_MCP_VALIDATION_TOOLS = Object.freeze([
  "skills_input_validate",
  "skills_output_validate",
] as const);

/** Evidence family (§9.2). */
const LINKSKILLS_MCP_EVIDENCE_TOOLS = Object.freeze([
  "skills_feedback_submit",
  "skills_trace_candidate_submit",
] as const);

/** Full frozen Skills MCP include list for Lisa. */
export const LINKSKILLS_MCP_TOOL_ALLOWLIST = Object.freeze([
  ...LINKSKILLS_MCP_DISCOVERY_TOOLS,
  ...LINKSKILLS_MCP_RUN_TOOLS,
  ...LINKSKILLS_MCP_MEDIATION_TOOLS,
  ...LINKSKILLS_MCP_VALIDATION_TOOLS,
  ...LINKSKILLS_MCP_EVIDENCE_TOOLS,
] as const);

/** Standard sessionless Skills operations; legacy v1 stays compatibility-only. */
export const LINKSKILLS_MCP_V2_TOOLS = Object.freeze([...SKILLS_V2_OPERATIONS] as const);

export const LINKSKILLS_LEGACY_MCP_COMPATIBILITY_CONTRACT = Object.freeze({
  id: "linkskills.mcp-legacy/0.2",
  removal: "after all configured consumers advertise skills.api.v0.2",
  tools: LINKSKILLS_MCP_TOOL_ALLOWLIST,
});

/** Production standard surface: v2 only; compatibility is never implicit. */
export const LINKSKILLS_MCP_MANAGED_TOOL_ALLOWLIST = LINKSKILLS_MCP_V2_TOOLS;

type LinkskillsMcpAllowedTool =
  | (typeof LINKSKILLS_MCP_TOOL_ALLOWLIST)[number]
  | (typeof LINKSKILLS_MCP_V2_TOOLS)[number];

const allowedSet = new Set<string>([...LINKSKILLS_MCP_TOOL_ALLOWLIST, ...LINKSKILLS_MCP_V2_TOOLS]);

/**
 * Returns whether a discovered MCP tool name is on the Skills §9.2 allowlist.
 * Unknown names are default-denied.
 */
export function isAllowedLinkskillsMcpTool(toolName: string): toolName is LinkskillsMcpAllowedTool {
  return allowedSet.has(toolName);
}

/**
 * Builds the OpenClaw `toolFilter` object for `mcp.servers.linkskills`.
 * Include-only (no exclude) so unreviewed Skills tools stay denied.
 */
export function buildLinkskillsMcpToolFilter(): {
  include: readonly (typeof LINKSKILLS_MCP_TOOL_ALLOWLIST)[number][];
} {
  return { include: LINKSKILLS_MCP_TOOL_ALLOWLIST };
}

export function buildLinkskillsV2McpToolFilter(): { include: readonly string[] } {
  return { include: LINKSKILLS_MCP_V2_TOOLS };
}

/**
 * Asserts a tool name is allowlisted; throws on default-deny.
 */
export function assertAllowedLinkskillsMcpTool(toolName: string): LinkskillsMcpAllowedTool {
  if (!isAllowedLinkskillsMcpTool(toolName)) {
    throw new Error(
      `linkskills: MCP tool "${toolName}" is not on the §9.2 allowlist (default-deny)`,
    );
  }
  return toolName;
}

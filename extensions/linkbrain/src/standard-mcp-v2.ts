/**
 * Standard MCP v2 Brain consumer surface (sessionless brain.v2/2.0.0).
 * Frozen v1 /mcp names remain LINKBRAIN_LEGACY_MCP_COMPATIBILITY_CONTRACT only.
 */
import { BRAIN_V2_OPERATIONS, type BrainV2Operation } from "./v2-pins.js";

export const LINKBRAIN_V2_READ_OPERATIONS = Object.freeze([
  "v2.knowledge.browse",
  "v2.knowledge.search",
  "v2.knowledge.load",
] as const);

export const LINKBRAIN_V2_CONTENT_OPERATIONS = Object.freeze([
  "v2.knowledge.load",
  "v2.projection.get",
  "v2.projection.evidence",
] as const);

export const LINKBRAIN_STANDARD_MCP_OPERATIONS = BRAIN_V2_OPERATIONS;

export function isStandardBrainMcpOperation(toolName: string): toolName is BrainV2Operation {
  return (BRAIN_V2_OPERATIONS as readonly string[]).includes(toolName);
}

export function isStandardBrainReadOperation(
  toolName: string,
): toolName is (typeof LINKBRAIN_V2_READ_OPERATIONS)[number] {
  return (LINKBRAIN_V2_READ_OPERATIONS as readonly string[]).includes(toolName);
}

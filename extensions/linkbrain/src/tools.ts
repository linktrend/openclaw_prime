/**
 * Brain MCP tool allowlist enforced before any fake/remote write.
 * Unknown tool names are rejected client-side (never forwarded).
 */

export const LINKBRAIN_CAPTURE_TOOL = "brain_capture_batch" as const;
export const LINKBRAIN_CHECKPOINT_TOOL = "brain_checkpoint_write" as const;
export const LINKBRAIN_TASK_UPDATE_TOOL = "brain_task_update" as const;

/** Tools the Phase 3 plugin may invoke through the transport. */
export const LINKBRAIN_ALLOWED_WRITE_TOOLS = Object.freeze([
  LINKBRAIN_CAPTURE_TOOL,
  LINKBRAIN_CHECKPOINT_TOOL,
  LINKBRAIN_TASK_UPDATE_TOOL,
] as const);

type LinkbrainAllowedWriteTool = (typeof LINKBRAIN_ALLOWED_WRITE_TOOLS)[number];

const allowedSet = new Set<string>(LINKBRAIN_ALLOWED_WRITE_TOOLS);

export function isAllowedBrainWriteTool(toolName: string): toolName is LinkbrainAllowedWriteTool {
  return allowedSet.has(toolName);
}

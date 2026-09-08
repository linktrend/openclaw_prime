/**
 * Process-local generation for MCP tool-filter registrations.
 * Catalog materialization observes this to invalidate stale filtered catalogs.
 */
const MCP_TOOL_FILTER_GLOBAL_STATE_KEY = Symbol.for("openclaw.mcpServerToolFilterGlobalState");

type McpToolFilterGlobalState = {
  registrationGeneration: number;
};

function getGlobalState(): McpToolFilterGlobalState {
  const globalStore = globalThis as Record<PropertyKey, unknown>;
  const existing = globalStore[MCP_TOOL_FILTER_GLOBAL_STATE_KEY] as
    | McpToolFilterGlobalState
    | undefined;
  if (existing) {
    return existing;
  }
  const state: McpToolFilterGlobalState = { registrationGeneration: 0 };
  globalStore[MCP_TOOL_FILTER_GLOBAL_STATE_KEY] = state;
  return state;
}

/** Bump when a trusted plugin applies/updates its tool-filter registration. */
export function bumpMcpToolFilterRegistrationGeneration(): void {
  getGlobalState().registrationGeneration += 1;
}

/** Catalog runtimes observe this to invalidate stale filtered catalogs. */
export function getMcpToolFilterRegistrationGeneration(): number {
  return getGlobalState().registrationGeneration;
}

/** Test-only reset. */
export function resetMcpToolFilterRegistrationGeneration(): void {
  getGlobalState().registrationGeneration = 0;
}

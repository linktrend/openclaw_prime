/** Plugin-owned MCP server tool-filter contracts. */

/**
 * Process-local tool selection overlay for one statically declared MCP server.
 * Operator `mcp.servers.<id>.toolFilter` remains the ceiling; this overlay is
 * intersected at catalog materialization and never written to config.
 */
export type McpServerToolFilterResolved = {
  include?: string[];
  exclude?: string[];
};

/**
 * Plugin-owned tool-filter resolver for a statically declared MCP server.
 * Server name stays static; selection is config ∩ plugin overlay (process-local).
 */
export type OpenClawPluginMcpServerToolFilter = {
  /** Server name matching `mcp.servers` / bundle MCP declaration. */
  serverName: string;
  /**
   * Returns the plugin overlay for the next catalog materialization.
   * - `null` omits all tools for this server (default-deny / independent rollback).
   * - `{ include }` is intersected with the operator allowlist ceiling.
   * - `{ exclude }` is applied after include (union with operator excludes).
   */
  resolve: () => McpServerToolFilterResolved | null | Promise<McpServerToolFilterResolved | null>;
};

/** Registry entry for a plugin MCP server tool-filter resolver. */
export type PluginMcpServerToolFilterRegistration = {
  pluginId: string;
  pluginName?: string;
  resolver: OpenClawPluginMcpServerToolFilter;
  source: string;
  rootDir?: string;
};

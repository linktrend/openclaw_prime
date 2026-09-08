/** Type declarations for Skills fake stdio MCP helpers. */
export declare function handleRpc(
  service: import("./service.mjs").SkillsFakeService,
  message: unknown,
): Record<string, unknown> | null;

export declare function createStdioMcpLoop(
  service: import("./service.mjs").SkillsFakeService,
): Promise<void>;

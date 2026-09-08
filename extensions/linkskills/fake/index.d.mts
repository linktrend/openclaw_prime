/** Type declarations for the Skills fake public barrel. */
export * from "./constants.mjs";
export * from "./prohibited.mjs";
export * from "./auth.mjs";
export * from "./service.mjs";
export * from "./harness.mjs";

export declare function startSkillsFakeHttp(opts?: {
  service?: import("./service.mjs").SkillsFakeService;
  host?: string;
}): Promise<{
  service: import("./service.mjs").SkillsFakeService;
  server: import("node:http").Server;
  host: string;
  port: number;
  baseUrl: string;
  stop: () => Promise<void>;
}>;

export declare function createStdioMcpLoop(
  service: import("./service.mjs").SkillsFakeService,
): Promise<void>;

export declare function handleRpc(
  service: import("./service.mjs").SkillsFakeService,
  message: unknown,
): Record<string, unknown> | null;

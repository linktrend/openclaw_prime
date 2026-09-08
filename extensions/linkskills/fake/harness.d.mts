/** Type declarations for the Skills fake HTTP harness. */
export declare function fixtureSkillsClaim(
  overrides?: Record<string, unknown>,
): Record<string, unknown>;

export declare function startInProcessSkillsFake(opts?: { throttleAfter?: number }): Promise<{
  mode: "in-process" | "child-process";
  baseUrl: string;
  port: number;
  pid?: number;
  service?: import("./service.mjs").SkillsFakeService;
  stop: () => Promise<void>;
  invoke: (
    operation: string,
    body?: Record<string, unknown>,
    opts?: { authorization?: string },
  ) => Promise<{ status: number; body: Record<string, unknown> }>;
  health: () => Promise<Record<string, unknown>>;
  negotiateVersion: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
}>;

export declare function startChildProcessSkillsFake(opts?: { throttleAfter?: number }): Promise<{
  mode: "in-process" | "child-process";
  baseUrl: string;
  port: number;
  pid?: number;
  stop: () => Promise<void>;
  invoke: (
    operation: string,
    body?: Record<string, unknown>,
    opts?: { authorization?: string },
  ) => Promise<{ status: number; body: Record<string, unknown> }>;
  health: () => Promise<Record<string, unknown>>;
  negotiateVersion: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
}>;

export declare function mintFakeToken(claims: Record<string, unknown>): string;

/** Type declarations for the Brain fake runtime. */
export declare const BRAIN_CONTRACT_VERSION: string;
export declare const BRAIN_TOOL_NAMES: readonly string[];

export declare function createBrainFake(options?: {
  fixturesDir?: string;
  now?: () => string;
  throttleAfter?: number;
  forceFailure?: string | null;
}): {
  fixturesDir: string;
  contractVersion: string;
  listTools: () => Array<{ name: string; description: string; inputSchema: unknown }>;
  callTool: (
    toolName: string,
    args?: Record<string, unknown>,
    meta?: { authToken?: string; requestId?: string },
  ) => Record<string, unknown> & {
    ok: boolean;
    replayed?: boolean;
    result?: Record<string, unknown>;
    error?: Record<string, unknown>;
  };
  health: () => Record<string, unknown>;
  negotiateVersion: (requested?: string) => Record<string, unknown> & {
    ok: boolean;
    compatible?: boolean;
  };
  getIdempotencySize: () => number;
  clearIdempotency: () => void;
  setForceFailure: (kind: string | null) => void;
  setThrottleAfter: (count: number | null) => void;
};

export declare function validateBrainPayload(payload: unknown): {
  ok: boolean;
  code?: string;
  fields?: string[];
  safeMessage?: string;
};

export declare function handleBrainMcpMessage(
  fake: ReturnType<typeof createBrainFake>,
  message: unknown,
): {
  jsonrpc: "2.0";
  id?: unknown;
  result?: {
    tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>;
    [key: string]: unknown;
  };
  error?: Record<string, unknown>;
} | null;

export declare function listBrainTools(): Array<{
  name: string;
  description: string;
  inputSchema: unknown;
}>;

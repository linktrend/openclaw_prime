/** Type declarations for the Skills fake service. */
export declare class ServiceError extends Error {
  code: string;
  httpStatus: number;
  retryable: boolean;
  details?: Record<string, unknown>;
  fieldErrors?: Array<{ path: string; message: string }>;
  constructor(
    code: string,
    message: string,
    opts?: {
      httpStatus?: number;
      retryable?: boolean;
      details?: Record<string, unknown>;
      fieldErrors?: Array<{ path: string; message: string }>;
    },
  );
}

export declare class SkillsFakeService {
  idempotency: Map<string, Record<string, unknown>>;
  runs: Map<string, Record<string, unknown>>;
  requestCount: number;
  throttleAfter: number;
  skill: Record<string, unknown>;
  constructor(opts?: { throttleAfter?: number; nowMs?: () => number });
  health(): Record<string, unknown>;
  negotiateVersion(body?: Record<string, unknown>): Record<string, unknown>;
  listTools(): Array<{ name: string; description?: string; inputSchema?: unknown }>;
  dispatch(
    operation: string,
    args?: Record<string, unknown>,
    meta?: { authorization?: string },
  ): Record<string, unknown>;
  toErrorEnvelope(err: unknown): Record<string, unknown> & { httpStatus?: number };
}

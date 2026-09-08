/** Type declarations for Skills fake auth helpers. */
export declare class AuthError extends Error {
  code: string;
  httpStatus: number;
  retryable: boolean;
  constructor(code: string, message: string, opts?: { httpStatus?: number; retryable?: boolean });
}

export declare function mintFakeToken(claims: Record<string, unknown>): string;

export declare function verifyAuthorization(
  authorization: string | undefined | null,
  opts?: { nowMs?: number; requestPayload?: unknown },
): {
  actor_id: string;
  actor_kind: string;
  org_id: string;
  scopes: string[];
  audience: string;
  exp: number;
  credential_id: string;
};

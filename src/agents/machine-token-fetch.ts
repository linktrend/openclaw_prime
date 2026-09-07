/**
 * Bearer injection for machine-token bindings on remote MCP HTTP fetches.
 *
 * Resource requests may use an injected MCP resource fetchFn. Discovery/token
 * mint NEVER falls back to that resource fetch — omit authFetchFn to use the
 * hardened machine-token network, or pass an explicit auth-only fetch (test
 * seam) that still must not be the general MCP resource transport.
 *
 * Same-origin resource requests get a resolved Bearer. One bounded reissue on
 * matching 401 and 403 — never retry endlessly.
 */
import type { FetchLike } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { MachineTokenFetchFn } from "./machine-token-types.js";
import {
  invalidateMachineTokenCache,
  resolveMachineTokenAccess,
  type MachineTokenBinding,
} from "./machine-token.js";

function withBearerHeader(headers: Headers, accessToken: string): Headers {
  const next = new Headers(headers);
  next.set("authorization", `Bearer ${accessToken}`);
  return next;
}

function mergeRequestHeaders(
  configured: Record<string, string> | undefined,
  init: RequestInit | undefined,
): Headers {
  const headers = new Headers(configured);
  for (const [key, value] of new Headers(init?.headers)) {
    if (key.toLowerCase() !== "authorization") {
      headers.set(key, value);
    }
  }
  return headers;
}

function isBoundedReissueStatus(status: number): boolean {
  return status === 401 || status === 403;
}

/** Wrap fetch with same-origin machine-token bearer injection. */
export function withMachineTokenBearer(params: {
  /** MCP / resource transport fetch (may be injected). Never used for mint. */
  fetchFn: FetchLike | MachineTokenFetchFn;
  /**
   * Optional auth-only fetch for discovery/token mint (TEST SEAM).
   * When omitted, resolveMachineTokenAccess uses the hardened auth network
   * (fetchWithSsrFGuard). Must never be the general MCP resource fetchFn.
   */
  authFetchFn?: FetchLike | MachineTokenFetchFn;
  serverName?: string;
  resourceUrl: string;
  headers?: Record<string, string>;
  binding: MachineTokenBinding;
}): FetchLike {
  const resourceOrigin = new URL(params.resourceUrl).origin;
  // Do NOT fall back to params.fetchFn — that would let an injected MCP
  // resource fetch bypass the hardened auth network boundary.
  const authFetchFn = params.authFetchFn;
  const machineTokenAuthFetch: MachineTokenFetchFn | undefined = authFetchFn
    ? (input, init) => authFetchFn(input instanceof Request ? input.url : input, init)
    : undefined;

  return async (url, init) => {
    if (new URL(url).origin !== resourceOrigin) {
      return params.fetchFn(url, init);
    }

    const signal = (init as RequestInit | undefined)?.signal ?? undefined;
    const baseHeaders = mergeRequestHeaders(params.headers, init as RequestInit | undefined);
    const first = await resolveMachineTokenAccess({
      binding: params.binding,
      ...(machineTokenAuthFetch ? { fetchFn: machineTokenAuthFetch } : {}),
      ...(signal ? { signal } : {}),
    });
    void params.serverName;

    const firstResponse = await params.fetchFn(url, {
      ...(init as RequestInit),
      headers: withBearerHeader(baseHeaders, first.accessToken),
    });
    if (!isBoundedReissueStatus(firstResponse.status)) {
      return firstResponse;
    }

    // One bounded reissue after resource 401/403 — never loop.
    invalidateMachineTokenCache(params.binding);
    const second = await resolveMachineTokenAccess({
      binding: params.binding,
      ...(machineTokenAuthFetch ? { fetchFn: machineTokenAuthFetch } : {}),
      forceRefresh: true,
      ...(signal ? { signal } : {}),
    });
    return await params.fetchFn(url, {
      ...(init as RequestInit),
      headers: withBearerHeader(baseHeaders, second.accessToken),
    });
  };
}

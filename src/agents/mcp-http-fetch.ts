/**
 * MCP HTTP fetch wrappers.
 * Adds SSRF protection, scoped TLS/client-cert dispatchers, response cleanup,
 * and same-origin header handling around the MCP SDK fetch contract.
 */
import fs from "node:fs";
import type { FetchLike } from "@modelcontextprotocol/sdk/shared/transport.js";
import { fetchWithSsrFGuard } from "../infra/net/fetch-guard.js";
import { wrapGuardedBodyStream } from "../infra/net/guarded-body-stream.js";
import {
  ssrfPolicyFromHttpBaseUrlAllowedOrigin,
  type PinnedDispatcherPolicy,
} from "../infra/net/ssrf.js";
import { loadUndiciRuntimeDeps } from "../infra/net/undici-runtime.js";

/** Default MCP HTTP fetch backed by lazy-loaded undici runtime deps. */
const fetchWithUndici: FetchLike = async (url, init) =>
  (await loadUndiciRuntimeDeps().fetch(
    url,
    init as Parameters<ReturnType<typeof loadUndiciRuntimeDeps>["fetch"]>[1],
  )) as unknown as Response;

const fetchWithUndiciGuard = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => await fetchWithUndici(input instanceof Request ? input.url : input, init);

const MCP_HTTP_MAX_REDIRECTS = 20;

/**
 * Host ceiling for cumulative MCP HTTP/SSE/Streamable HTTP response bodies.
 * Matches the repo's common 16 MiB HTTP response bound; independent of
 * MACHINE_TOKEN_MAX_RESPONSE_BYTES (auth path stays separate).
 *
 * This is an enforced maximum, not merely a default: caller
 * `maxResponseBytes` may only reduce the effective bound.
 */
export const MCP_HTTP_MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

/**
 * Resolve the effective MCP HTTP response byte bound.
 *
 * Contract:
 * - `undefined` → {@link MCP_HTTP_MAX_RESPONSE_BYTES}
 * - positive safe integer ≤ host max → that value (caller may only reduce)
 * - positive safe integer > host max → clamped to {@link MCP_HTTP_MAX_RESPONSE_BYTES}
 * - zero, negative, fractional, non-finite (`NaN`/`Infinity`), non-integer,
 *   or unsafe integer → rejected with a clear error (fail closed)
 *
 * No env override, plugin bypass, or Brain/Skills special case.
 */
export function resolveMcpHttpMaxResponseBytes(maxResponseBytes?: number): number {
  if (maxResponseBytes === undefined) {
    return MCP_HTTP_MAX_RESPONSE_BYTES;
  }
  if (
    typeof maxResponseBytes !== "number" ||
    !Number.isFinite(maxResponseBytes) ||
    !Number.isInteger(maxResponseBytes) ||
    !Number.isSafeInteger(maxResponseBytes) ||
    maxResponseBytes <= 0
  ) {
    throw new Error(
      "MCP HTTP maxResponseBytes must be a positive safe integer " +
        `(at most ${MCP_HTTP_MAX_RESPONSE_BYTES} bytes)`,
    );
  }
  return Math.min(maxResponseBytes, MCP_HTTP_MAX_RESPONSE_BYTES);
}

/** True when a declared Content-Length is present and exceeds the byte cap. */
function isDeclaredMcpContentLengthOverLimit(response: Response, maxBytes: number): boolean {
  const raw = response.headers.get("content-length");
  if (raw === null) {
    return false;
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return false;
  }
  const size = Number(trimmed);
  return Number.isSafeInteger(size) && size > maxBytes;
}

function resolveFetchRequest(input: RequestInfo | URL, init?: RequestInit) {
  if (input instanceof Request) {
    const request = new Request(input, init);
    const body = request.body ?? undefined;
    return {
      url: request.url,
      signal: request.signal,
      init: {
        method: request.method,
        headers: request.headers,
        body,
        redirect: request.redirect,
        ...(body ? ({ duplex: "half" } as const) : {}),
      } satisfies RequestInit & { duplex?: "half" },
    };
  }
  const { signal, ...requestInit } = init ?? {};
  return {
    url: input instanceof URL ? input.toString() : input,
    signal: signal ?? undefined,
    init: init ? requestInit : undefined,
  };
}

async function ensureGlobalFetchResponse(response: Response): Promise<Response> {
  const init = {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  };
  if (response.body != null) {
    return new Response(response.body, init);
  }
  if (response.status === 204 || response.status === 205 || response.status === 304) {
    return new Response(null, init);
  }
  // A body-less foreign Response exposes no bounded reader. Calling text() or
  // arrayBuffer() can allocate an attacker-controlled body before any cap applies.
  return new Response(null, init);
}

async function buildManagedMcpResponse(
  response: Response,
  release: () => Promise<void>,
  options: {
    refreshTimeout?: () => void;
    maxBytes: number;
  },
): Promise<Response> {
  const maxBytes = options.maxBytes;
  if (isDeclaredMcpContentLengthOverLimit(response, maxBytes)) {
    try {
      await response.body?.cancel().catch(() => undefined);
    } finally {
      await release().catch(() => undefined);
    }
    // Limit only — never echo body/token bytes or Authorization material.
    throw new Error(`MCP HTTP response exceeds ${maxBytes} bytes`);
  }

  if (!response.body) {
    void release();
    return await ensureGlobalFetchResponse(response);
  }

  const wrappedBody = wrapGuardedBodyStream({
    body: response.body,
    cleanup: release,
    refreshTimeout: options.refreshTimeout,
    maxBytes,
  });
  return await ensureGlobalFetchResponse(
    new Response(wrappedBody, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }),
  );
}

/** Builds an MCP fetch function with optional TLS/client-cert dispatcher support. */
export function buildMcpHttpFetch(params: {
  sslVerify?: boolean;
  clientCert?: string;
  clientKey?: string;
  resourceUrl?: string;
  timeoutMs?: number;
  /**
   * Optional cumulative response body cap. May only reduce the host ceiling
   * ({@link MCP_HTTP_MAX_RESPONSE_BYTES}); larger values clamp to that max.
   * Invalid values (zero/negative/fractional/non-finite/unsafe) throw at build time.
   */
  maxResponseBytes?: number;
}): FetchLike {
  const needsCustomDispatcher =
    params.sslVerify === false || Boolean(params.clientCert || params.clientKey);
  const scopedOrigin = params.resourceUrl ? new URL(params.resourceUrl).origin : undefined;
  const policy = params.resourceUrl
    ? ssrfPolicyFromHttpBaseUrlAllowedOrigin(params.resourceUrl)
    : undefined;
  const maxResponseBytes = resolveMcpHttpMaxResponseBytes(params.maxResponseBytes);

  let customConnect: Record<string, unknown> | undefined;
  const resolveCustomDispatcherPolicy = (url: URL): PinnedDispatcherPolicy | undefined => {
    if (!needsCustomDispatcher || !scopedOrigin || url.origin !== scopedOrigin) {
      return undefined;
    }
    customConnect ??= {
      ...(params.sslVerify === false ? { rejectUnauthorized: false } : {}),
      ...(params.clientCert ? { cert: fs.readFileSync(params.clientCert, "utf-8") } : {}),
      ...(params.clientKey ? { key: fs.readFileSync(params.clientKey, "utf-8") } : {}),
    };
    return { mode: "direct", connect: customConnect };
  };

  return async (url, init) => {
    const request = resolveFetchRequest(url, init);
    const guardedFetchOptions = {
      url: request.url,
      init: request.init,
      fetchImpl: fetchWithUndiciGuard,
      maxRedirects: MCP_HTTP_MAX_REDIRECTS,
      allowCrossOriginUnsafeRedirectReplay: true,
      auditContext: "mcp-http",
      useEnvProxyForEligibleUrls: true,
      ...(request.signal ? { signal: request.signal } : {}),
      ...(params.timeoutMs !== undefined ? { timeoutMs: params.timeoutMs } : {}),
      ...(policy ? { policy } : {}),
      ...(needsCustomDispatcher ? { resolveDispatcherPolicy: resolveCustomDispatcherPolicy } : {}),
    };
    const guarded = await fetchWithSsrFGuard(guardedFetchOptions);
    return await buildManagedMcpResponse(guarded.response, guarded.release, {
      refreshTimeout: guarded.refreshTimeout,
      maxBytes: maxResponseBytes,
    });
  };
}

/** Removes Authorization from MCP headers before forwarding to non-authorized paths. */
export function withoutMcpAuthorizationHeader(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }
  const entries = Object.entries(headers).filter(([key]) => key.toLowerCase() !== "authorization");
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/** Wraps MCP fetch so configured headers are applied only to the resource origin. */
export function withSameOriginMcpHttpHeaders(params: {
  fetchFn: FetchLike;
  headers: Record<string, string> | undefined;
  resourceUrl: string;
}): FetchLike {
  if (!params.headers || Object.keys(params.headers).length === 0) {
    return params.fetchFn;
  }
  const resourceOrigin = new URL(params.resourceUrl).origin;
  return (url, init) => {
    if (new URL(url).origin !== resourceOrigin) {
      return params.fetchFn(url, init);
    }
    const headers = new Headers(params.headers);
    for (const [key, value] of new Headers(init?.headers)) {
      headers.set(key, value);
    }
    return params.fetchFn(url, { ...(init as RequestInit), headers });
  };
}

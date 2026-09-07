/**
 * Hardened network boundary for machine-token discovery and token mint calls.
 *
 * Production paths use fetchWithSsrFGuard (SSRF/DNS/TLS-safe), zero redirects,
 * fixed deadlines, and bounded request/response sizes. Injected fetchFn is an
 * explicit TEST SEAM that bypasses the SSRF guard so hermetic PACI fakes and
 * unit stubs can run without DNS pinning — document and keep test-only.
 * General MCP resource fetchFn must never be passed as this seam.
 */
import { readResponseWithLimit } from "../infra/http-body.js";
import { fetchWithSsrFGuard } from "../infra/net/fetch-guard.js";
import type { SsrFPolicy } from "../infra/net/ssrf.js";
import type { MachineTokenFetchFn } from "./machine-token-types.js";

/** Bound connect/response deadline for discovery and token requests. */
export const MACHINE_TOKEN_NETWORK_TIMEOUT_MS = 15_000;

/** Max JSON body size for discovery/token responses (including non-2xx drains). */
export const MACHINE_TOKEN_MAX_RESPONSE_BYTES = 64 * 1024;

/** Max outbound request body size for token mint (client_assertion form body). */
export const MACHINE_TOKEN_MAX_REQUEST_BODY_BYTES = 16 * 1024;

/** Max outbound request header byte budget (name+value lengths). */
export const MACHINE_TOKEN_MAX_REQUEST_HEADER_BYTES = 8 * 1024;

function networkError(message: string, cause?: unknown): Error {
  return new Error(message, cause !== undefined ? { cause } : undefined);
}

function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/gu, "");
}

/** True for explicit local-test loopback hostnames only. */
export function isMachineTokenLocalTestLoopbackHost(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/**
 * Enforce HTTPS for non-local-test endpoints; HTTP only for explicit local-test
 * loopback (127.0.0.1 / ::1 / localhost).
 */
export function assertMachineTokenNetworkUrl(params: {
  url: string;
  localTest?: boolean;
  /**
   * Production trusted-private issuer opt-in. Allowed only with HTTPS outside
   * local-test; does not relax HTTP or loopback rules by itself.
   */
  allowPrivateNetwork?: boolean;
  label: string;
}): URL {
  let parsed: URL;
  try {
    parsed = new URL(params.url);
  } catch (cause) {
    throw networkError(`Machine-token ${params.label} is not a valid absolute URL`, cause);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw networkError(`Machine-token ${params.label} must use http or https`);
  }
  if (parsed.username || parsed.password) {
    throw networkError(`Machine-token ${params.label} must not include userinfo`);
  }
  const loopback = isMachineTokenLocalTestLoopbackHost(parsed.hostname);
  if (parsed.protocol === "http:") {
    if (params.localTest !== true || !loopback) {
      throw networkError(
        `Machine-token ${params.label} must use HTTPS (HTTP is allowed only for explicit local-test loopback)`,
      );
    }
  }
  if (params.localTest !== true && loopback) {
    throw networkError(
      `Machine-token ${params.label} must not target loopback outside explicit local-test mode`,
    );
  }
  // Trusted-private opt-in is HTTPS-only outside local-test (HTTP already gated above).
  if (
    params.allowPrivateNetwork === true &&
    params.localTest !== true &&
    parsed.protocol !== "https:"
  ) {
    throw networkError(
      `Machine-token ${params.label} allowPrivateNetwork requires HTTPS outside local-test mode`,
    );
  }
  return parsed;
}

/**
 * Build the SSRF policy for a machine-token discovery/token URL.
 *
 * - Default: undefined (reject private/link-local/reserved).
 * - localTest: broad private/loopback allowance for hermetic loopback issuers.
 * - allowPrivateNetwork (production): pin exact HTTPS origin+hostname so only
 *   that issuer may resolve private/CGNAT/Tailscale. Prefer pinning without
 *   SsrFPolicy.allowPrivateNetwork so metadata/link-local DNS rebinding stays blocked.
 */
export function buildMachineTokenSsrFPolicy(params: {
  url: string;
  localTest?: boolean;
  allowPrivateNetwork?: boolean;
}): SsrFPolicy | undefined {
  if (params.localTest === true) {
    return { allowPrivateNetwork: true };
  }
  if (params.allowPrivateNetwork !== true) {
    return undefined;
  }
  const parsed = new URL(params.url);
  return {
    allowedOrigins: [parsed.origin],
    allowedHostnames: [normalizeHostname(parsed.hostname)],
  };
}

function measureRequestBodyBytes(body: BodyInit): number | undefined {
  if (typeof body === "string") {
    return Buffer.byteLength(body);
  }
  if (body instanceof URLSearchParams) {
    return Buffer.byteLength(body.toString());
  }
  if (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) {
    return body.byteLength;
  }
  if (ArrayBuffer.isView(body)) {
    return body.byteLength;
  }
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return body.size;
  }
  return undefined;
}

/**
 * Bound outbound auth request headers/body before any network call.
 * Streaming bodies are rejected — mint uses fixed form-urlencoded payloads only.
 */
export function assertMachineTokenRequestBounds(params: {
  init?: RequestInit;
  label: string;
}): void {
  const init = params.init;
  if (!init) {
    return;
  }
  if (init.headers) {
    let headerBytes = 0;
    new Headers(init.headers).forEach((value, key) => {
      headerBytes += key.length + value.length;
    });
    if (headerBytes > MACHINE_TOKEN_MAX_REQUEST_HEADER_BYTES) {
      throw networkError(`Machine-token ${params.label} request headers exceed size limit`);
    }
  }
  if (init.body == null) {
    return;
  }
  const size = measureRequestBodyBytes(init.body);
  if (size === undefined) {
    throw networkError(
      `Machine-token ${params.label} request must use a bounded non-streaming body`,
    );
  }
  if (size > MACHINE_TOKEN_MAX_REQUEST_BODY_BYTES) {
    throw networkError(`Machine-token ${params.label} request body exceeds size limit`);
  }
}

function assertJsonContentType(response: Response, label: string): void {
  const contentType = response.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (mediaType !== "application/json") {
    throw networkError(`Machine-token ${label} response content-type must be application/json`);
  }
}

async function readJsonBody(params: {
  response: Response;
  label: string;
  signal?: AbortSignal;
}): Promise<unknown> {
  params.signal?.throwIfAborted();
  assertJsonContentType(params.response, params.label);
  let buffer: Buffer;
  try {
    buffer = await readResponseWithLimit(params.response, MACHINE_TOKEN_MAX_RESPONSE_BYTES, {
      timeoutMs: MACHINE_TOKEN_NETWORK_TIMEOUT_MS,
      onOverflow: () => networkError(`Machine-token ${params.label} response exceeds size limit`),
      onTimeout: () => networkError(`Machine-token ${params.label} response body timed out`),
    });
  } catch (cause) {
    params.signal?.throwIfAborted();
    if (cause instanceof Error && cause.message.startsWith("Machine-token ")) {
      throw cause;
    }
    throw networkError(`Machine-token ${params.label} response body read failed`, cause);
  }
  params.signal?.throwIfAborted();
  try {
    return JSON.parse(buffer.toString("utf8")) as unknown;
  } catch (cause) {
    throw networkError(`Machine-token ${params.label} response is not valid JSON`, cause);
  }
}

/**
 * Drain a non-2xx body under the same size/time cap as success JSON.
 * Never parse or log body bytes (may contain secrets). Does not use unbounded
 * arrayBuffer() before the cap. Shared by mint (`machineTokenNetworkFetchJson`)
 * and discovery so both auth paths enforce the same drain contract.
 */
export async function discardMachineTokenErrorResponseBody(params: {
  response: Response;
  label: string;
  signal?: AbortSignal;
}): Promise<void> {
  if (!params.response.body) {
    return;
  }
  try {
    await readResponseWithLimit(params.response, MACHINE_TOKEN_MAX_RESPONSE_BYTES, {
      timeoutMs: MACHINE_TOKEN_NETWORK_TIMEOUT_MS,
      onOverflow: () =>
        networkError(`Machine-token ${params.label} error response exceeds size limit`),
      onTimeout: () => networkError(`Machine-token ${params.label} error response body timed out`),
    });
  } catch {
    // Overflow/timeout/cancel still enforced the byte cap; never surface body.
    params.signal?.throwIfAborted();
  }
}

export type MachineTokenNetworkFetchParams = {
  url: string;
  init?: RequestInit;
  /**
   * TEST SEAM: when provided, bypasses fetchWithSsrFGuard so hermetic PACI
   * fakes / stubs can mint without DNS pinning. Production callers omit this
   * and use the SSRF-guarded default path. Never pass a general MCP resource
   * fetch here — that would bypass the hardened auth network boundary.
   */
  fetchFn?: MachineTokenFetchFn;
  signal?: AbortSignal;
  localTest?: boolean;
  /** Production HTTPS trusted-private issuer opt-in (pinned origin/hostname). */
  allowPrivateNetwork?: boolean;
  timeoutMs?: number;
  label?: string;
};

export type MachineTokenNetworkResponse = {
  response: Response;
  /** Always call after the response body is consumed (or canceled). */
  release: () => Promise<void>;
};

/**
 * Fetch a machine-token discovery or token endpoint under the hardened boundary.
 *
 * Callers MUST invoke `release()` after consuming or canceling the body so the
 * SSRF dispatcher is closed (late-settlement safe; release is idempotent).
 */
export async function machineTokenNetworkFetch(
  params: MachineTokenNetworkFetchParams,
): Promise<MachineTokenNetworkResponse> {
  const label = params.label ?? "request";
  assertMachineTokenNetworkUrl({
    url: params.url,
    localTest: params.localTest,
    allowPrivateNetwork: params.allowPrivateNetwork,
    label,
  });
  assertMachineTokenRequestBounds({ init: params.init, label });

  // TEST SEAM: injected fetchFn bypasses SSRF guard for hermetic unit/fake servers.
  if (params.fetchFn) {
    try {
      const response = await params.fetchFn(params.url, {
        ...params.init,
        redirect: "error",
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return {
        response,
        release: async () => undefined,
      };
    } catch (cause) {
      params.signal?.throwIfAborted();
      throw networkError(`Machine-token ${label} request failed`, cause);
    }
  }

  const timeoutMs = params.timeoutMs ?? MACHINE_TOKEN_NETWORK_TIMEOUT_MS;
  const requireHttps = !(
    params.localTest === true && isMachineTokenLocalTestLoopbackHost(new URL(params.url).hostname)
  );
  try {
    const guarded = await fetchWithSsrFGuard({
      url: params.url,
      init: params.init,
      signal: params.signal,
      timeoutMs,
      requireHttps,
      // Auth path: never follow redirects; no cross-origin body replay possible.
      maxRedirects: 0,
      policy: buildMachineTokenSsrFPolicy({
        url: params.url,
        localTest: params.localTest,
        allowPrivateNetwork: params.allowPrivateNetwork,
      }),
      auditContext: "machine-token",
    });
    return {
      response: guarded.response,
      release: guarded.release,
    };
  } catch (cause) {
    params.signal?.throwIfAborted();
    throw networkError(`Machine-token ${label} request failed`, cause);
  }
}

/**
 * Fetch + bounded JSON parse with mandatory dispatcher release.
 *
 * Returns HTTP status separately so callers can map 429/5xx without reading
 * secrets from error bodies.
 */
export async function machineTokenNetworkFetchJson(
  params: MachineTokenNetworkFetchParams,
): Promise<{ status: number; ok: boolean; json: unknown }> {
  const label = params.label ?? "request";
  const { response, release } = await machineTokenNetworkFetch(params);
  try {
    if (!response.ok) {
      await discardMachineTokenErrorResponseBody({
        response,
        label,
        signal: params.signal,
      });
      return { status: response.status, ok: false, json: undefined };
    }
    const json = await readJsonBody({
      response,
      label,
      signal: params.signal,
    });
    return { status: response.status, ok: true, json };
  } finally {
    await release().catch(() => undefined);
  }
}

/**
 * Classify HTTP status for machine-token mint/discovery error messages.
 * No automatic retries — callers decide (resource path allows one 401/403 reissue).
 */
export function describeMachineTokenHttpFailure(status: number, label: string): string {
  if (status === 429) {
    return `Machine-token ${label} failed with HTTP 429 (rate limited)`;
  }
  if (status >= 500) {
    return `Machine-token ${label} failed with HTTP ${String(status)} (upstream error)`;
  }
  return `Machine-token ${label} failed with HTTP ${String(status)}`;
}

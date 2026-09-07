/**
 * Generic public machine-token access resolution (client_credentials + private_key_jwt).
 *
 * Discovers RFC 8414 metadata, mints Bearer access tokens, caches in process
 * memory with early renewal, and coalesces concurrent mint flights per immutable
 * binding fingerprint. Errors never include access tokens, assertions, or private keys.
 */
import { createAbortError } from "../infra/abort-signal.js";
import { createMachineTokenClientAssertion } from "./machine-token-assertion.js";
import {
  deleteCachedMachineToken,
  getCachedMachineToken,
  isCachedMachineTokenFresh,
  setCachedMachineToken,
} from "./machine-token-cache.js";
import { discoverMachineTokenAuthorizationServer } from "./machine-token-discovery.js";
import { buildMachineTokenBindingFingerprint } from "./machine-token-fingerprint.js";
import {
  describeMachineTokenHttpFailure,
  machineTokenNetworkFetchJson,
} from "./machine-token-network.js";
import type {
  MachineTokenBinding,
  MachineTokenFetchFn,
  ResolvedMachineToken,
} from "./machine-token-types.js";
import { MACHINE_TOKEN_FROZEN_EXPIRES_IN_SECONDS } from "./machine-token-types.js";

export type { MachineTokenBinding, ResolvedMachineToken } from "./machine-token-types.js";
export { MACHINE_TOKEN_FROZEN_EXPIRES_IN_SECONDS } from "./machine-token-types.js";
export {
  assertMachineTokenIssuerUrl,
  buildMachineTokenDiscoveryUrl,
  validateMachineTokenAuthorizationServerMetadata,
} from "./machine-token-discovery.js";
export {
  clearMachineTokenCache,
  MACHINE_TOKEN_EARLY_RENEWAL_REMAINING_FRACTION,
} from "./machine-token-cache.js";
export {
  buildMachineTokenBindingFingerprint,
  fingerprintMachineTokenKeyRef,
  fingerprintMachineTokenPemMaterial,
} from "./machine-token-fingerprint.js";
export {
  assertMachineTokenNetworkUrl,
  isMachineTokenLocalTestLoopbackHost,
  MACHINE_TOKEN_MAX_RESPONSE_BYTES,
  MACHINE_TOKEN_NETWORK_TIMEOUT_MS,
} from "./machine-token-network.js";

const CLIENT_ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

const inflightByFingerprint = new Map<string, Promise<ResolvedMachineToken>>();

function machineTokenError(message: string, cause?: unknown): Error {
  return new Error(message, cause !== undefined ? { cause } : undefined);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal) {
    return;
  }
  if (signal.aborted) {
    throw createAbortError("Machine token resolution aborted", {
      cause: signal.reason,
    });
  }
}

async function awaitWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) {
    return await promise;
  }
  throwIfAborted(signal);
  return await new Promise<T>((resolve, reject) => {
    let settled = false;
    const settle = (complete: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      signal.removeEventListener("abort", onAbort);
      complete();
    };
    const onAbort = () =>
      settle(() =>
        reject(
          createAbortError("Machine token resolution aborted", {
            cause: signal.reason,
          }),
        ),
      );
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    void promise.then(
      (value) => settle(() => resolve(value)),
      (error: unknown) =>
        settle(() => reject(error instanceof Error ? error : new Error(String(error)))),
    );
  });
}

function parseTokenResponse(
  body: unknown,
  nowMs: number,
): {
  accessToken: string;
  expiresAt: number;
  tokenType: "Bearer";
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw machineTokenError("Machine-token response must be a JSON object");
  }
  const raw = body as Record<string, unknown>;
  if ("refresh_token" in raw && raw.refresh_token != null && raw.refresh_token !== "") {
    throw machineTokenError(
      "Machine-token response included refresh_token; Phase-1 machine-token path rejects refresh tokens",
    );
  }
  if (typeof raw.access_token !== "string" || raw.access_token.length === 0) {
    throw machineTokenError("Machine-token response is missing access_token");
  }
  if (typeof raw.token_type !== "string" || raw.token_type.toLowerCase() !== "bearer") {
    throw machineTokenError("Machine-token response token_type must be Bearer");
  }
  if (raw.expires_in !== MACHINE_TOKEN_FROZEN_EXPIRES_IN_SECONDS) {
    throw machineTokenError(
      `Machine-token response expires_in must be exactly ${String(MACHINE_TOKEN_FROZEN_EXPIRES_IN_SECONDS)} seconds`,
    );
  }
  return {
    accessToken: raw.access_token,
    expiresAt: nowMs + MACHINE_TOKEN_FROZEN_EXPIRES_IN_SECONDS * 1000,
    tokenType: "Bearer",
  };
}

async function mintMachineTokenAccess(params: {
  binding: MachineTokenBinding;
  bindingFingerprint: string;
  fetchFn?: MachineTokenFetchFn;
  now: () => number;
  signal?: AbortSignal;
}): Promise<ResolvedMachineToken> {
  throwIfAborted(params.signal);
  const metadata = await discoverMachineTokenAuthorizationServer({
    issuerUrl: params.binding.issuerUrl,
    fetchFn: params.fetchFn,
    signal: params.signal,
    localTest: params.binding.localTest,
    allowPrivateNetwork: params.binding.allowPrivateNetwork,
  });
  throwIfAborted(params.signal);

  const assertion = await createMachineTokenClientAssertion({
    clientId: params.binding.clientId,
    tokenEndpoint: metadata.token_endpoint,
    clientAssertionKeyPem: params.binding.clientAssertionKeyPem,
    now: params.now,
  });
  throwIfAborted(params.signal);

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_assertion_type: CLIENT_ASSERTION_TYPE,
    client_assertion: assertion.assertion,
  });
  if (params.binding.scope) {
    body.set("scope", params.binding.scope);
  }

  let fetched: { status: number; ok: boolean; json: unknown };
  try {
    fetched = await machineTokenNetworkFetchJson({
      url: metadata.token_endpoint,
      init: {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body,
      },
      fetchFn: params.fetchFn,
      signal: params.signal,
      localTest: params.binding.localTest,
      allowPrivateNetwork: params.binding.allowPrivateNetwork,
      label: "token",
    });
  } catch (cause) {
    throwIfAborted(params.signal);
    if (cause instanceof Error && cause.message.startsWith("Machine-token ")) {
      throw cause;
    }
    throw machineTokenError("Machine-token token request failed", cause);
  }
  throwIfAborted(params.signal);

  if (!fetched.ok) {
    throw machineTokenError(describeMachineTokenHttpFailure(fetched.status, "token request"));
  }

  const nowMs = params.now();
  const parsed = parseTokenResponse(fetched.json, nowMs);
  const resolved: ResolvedMachineToken = {
    bindingId: params.binding.bindingId,
    bindingFingerprint: params.bindingFingerprint,
    accessToken: parsed.accessToken,
    expiresAt: parsed.expiresAt,
    tokenType: "Bearer",
  };
  setCachedMachineToken({
    ...resolved,
    issuedAt: nowMs,
  });
  return resolved;
}

/**
 * Remove one binding fingerprint's cached access token from process memory.
 *
 * Accepts either an immutable fingerprint string or a full binding (fingerprint
 * is derived). Passing an operator bindingId label alone does not match cache
 * entries — use the fingerprint or binding object.
 */
export function invalidateMachineTokenCache(
  fingerprintOrBinding: string | MachineTokenBinding,
): void {
  const fingerprint =
    typeof fingerprintOrBinding === "string"
      ? fingerprintOrBinding
      : buildMachineTokenBindingFingerprint(fingerprintOrBinding);
  deleteCachedMachineToken(fingerprint);
}

/**
 * Resolve a current Bearer access token for a machine-token binding.
 *
 * Reuses process cache when remaining TTL >= 20%. Concurrent callers for the
 * same binding fingerprint share one in-flight mint (Promise coalescing).
 *
 * When `fetchFn` is omitted, discovery/token calls use the hardened
 * machine-token network (fetchWithSsrFGuard, zero redirects, bounded bodies).
 * Injected `fetchFn` is a documented TEST SEAM that bypasses the SSRF guard —
 * never pass a general MCP resource fetchFn here.
 */
export async function resolveMachineTokenAccess(params: {
  binding: MachineTokenBinding;
  fetchFn?: MachineTokenFetchFn;
  now?: () => number;
  signal?: AbortSignal;
  forceRefresh?: boolean;
}): Promise<ResolvedMachineToken> {
  throwIfAborted(params.signal);
  const now = params.now ?? Date.now;
  const fingerprint = buildMachineTokenBindingFingerprint(params.binding);

  if (params.forceRefresh !== true) {
    const cached = getCachedMachineToken(fingerprint);
    if (cached && isCachedMachineTokenFresh(cached, now())) {
      return {
        bindingId: cached.bindingId,
        bindingFingerprint: cached.bindingFingerprint,
        accessToken: cached.accessToken,
        expiresAt: cached.expiresAt,
        tokenType: "Bearer",
      };
    }
  } else {
    deleteCachedMachineToken(fingerprint);
  }

  const existing = inflightByFingerprint.get(fingerprint);
  if (existing) {
    return await awaitWithAbort(existing, params.signal);
  }

  const flight = mintMachineTokenAccess({
    binding: params.binding,
    bindingFingerprint: fingerprint,
    fetchFn: params.fetchFn,
    now,
    signal: params.signal,
  }).finally(() => {
    if (inflightByFingerprint.get(fingerprint) === flight) {
      inflightByFingerprint.delete(fingerprint);
    }
  });
  inflightByFingerprint.set(fingerprint, flight);

  return await awaitWithAbort(flight, params.signal);
}

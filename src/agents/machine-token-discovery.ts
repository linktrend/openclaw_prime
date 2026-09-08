/**
 * RFC 8414 OAuth authorization-server discovery for machine-token issuers.
 *
 * Issuer MUST NOT end with `/` and MUST have no path. Discovery URL =
 * issuer + "/.well-known/oauth-authorization-server". Token/JWKS/introspection
 * endpoints must share the issuer origin. Phase-1 PACI metadata is frozen to
 * Platform `buildAuthorizationServerMetadata` (exact arrays; omit
 * authorization_endpoint). Errors never include secrets or tokens.
 */
import { readResponseWithLimit } from "../infra/http-body.js";
import {
  assertMachineTokenNetworkUrl,
  describeMachineTokenHttpFailure,
  discardMachineTokenErrorResponseBody,
  MACHINE_TOKEN_MAX_RESPONSE_BYTES,
  MACHINE_TOKEN_NETWORK_TIMEOUT_MS,
  machineTokenNetworkFetch,
} from "./machine-token-network.js";
import type {
  MachineTokenAuthorizationServerMetadata,
  MachineTokenFetchFn,
} from "./machine-token-types.js";

const DISCOVERY_SUFFIX = "/.well-known/oauth-authorization-server";

/** Exact Phase-1 PACI grant / auth / signing advertisements. */
const EXACT_GRANT_TYPES = ["client_credentials"] as const;
const EXACT_TOKEN_AUTH_METHODS = ["private_key_jwt"] as const;
const EXACT_SIGNING_ALGS = ["ES256"] as const;
const EXACT_INTROSPECTION_AUTH_METHODS = ["private_key_jwt"] as const;
const EXACT_RESPONSE_TYPES: readonly string[] = [];

export type DiscoverMachineTokenAuthorizationServerParams = {
  issuerUrl: string;
  fetchFn?: MachineTokenFetchFn;
  signal?: AbortSignal;
  /** Explicit local-test mode (HTTP loopback only). */
  localTest?: boolean;
  /** Production HTTPS trusted-private issuer opt-in. */
  allowPrivateNetwork?: boolean;
};

function discoveryError(message: string, cause?: unknown): Error {
  return new Error(message, cause !== undefined ? { cause } : undefined);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  signal?.throwIfAborted();
}

/**
 * Validate and parse an RFC 8414 issuer URL for machine-token discovery.
 *
 * @throws when the issuer has a trailing slash, path, or non-http(s) scheme
 */
export function assertMachineTokenIssuerUrl(issuerUrl: string, localTest?: boolean): URL {
  if (issuerUrl.endsWith("/")) {
    throw discoveryError("Machine-token issuer URL must not end with a trailing slash");
  }
  let url: URL;
  try {
    url = new URL(issuerUrl);
  } catch (cause) {
    throw discoveryError("Machine-token issuer URL is not a valid absolute URL", cause);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw discoveryError("Machine-token issuer URL must use http or https");
  }
  if (url.username || url.password) {
    throw discoveryError("Machine-token issuer URL must not include userinfo");
  }
  if (url.pathname !== "" && url.pathname !== "/") {
    throw discoveryError("Machine-token issuer URL must not include a path");
  }
  if (url.search || url.hash) {
    throw discoveryError("Machine-token issuer URL must not include query or fragment");
  }
  assertMachineTokenNetworkUrl({
    url: issuerUrl,
    localTest,
    label: "issuer URL",
  });
  return url;
}

/** Build the RFC 8414 discovery document URL for a validated issuer. */
export function buildMachineTokenDiscoveryUrl(issuerUrl: string, localTest?: boolean): string {
  assertMachineTokenIssuerUrl(issuerUrl, localTest);
  return `${issuerUrl}${DISCOVERY_SUFFIX}`;
}

function assertSameOriginEndpoint(params: {
  issuer: URL;
  endpoint: string;
  label: string;
  localTest?: boolean;
  allowPrivateNetwork?: boolean;
}): void {
  assertMachineTokenNetworkUrl({
    url: params.endpoint,
    localTest: params.localTest,
    allowPrivateNetwork: params.allowPrivateNetwork,
    label: params.label,
  });
  let endpointUrl: URL;
  try {
    endpointUrl = new URL(params.endpoint);
  } catch (cause) {
    throw discoveryError(`Machine-token ${params.label} is not a valid absolute URL`, cause);
  }
  if (endpointUrl.origin !== params.issuer.origin) {
    throw discoveryError(`Machine-token ${params.label} must share the issuer origin`);
  }
}

function assertExactStringArray(params: {
  value: unknown;
  field: string;
  expected: readonly string[];
}): string[] {
  if (!Array.isArray(params.value)) {
    throw discoveryError(`Machine-token discovery metadata ${params.field} must be an array`);
  }
  for (const value of params.value) {
    if (typeof value !== "string") {
      throw discoveryError(
        `Machine-token discovery metadata ${params.field} elements must be strings`,
      );
    }
  }
  const actual = params.value as string[];
  if (
    actual.length !== params.expected.length ||
    actual.some((entry, index) => entry !== params.expected[index])
  ) {
    throw discoveryError(
      `Machine-token discovery metadata ${params.field} must be exactly ${JSON.stringify(params.expected)}`,
    );
  }
  return actual;
}

/**
 * Reject top-level duplicate JSON object keys (JSON.parse keeps the last value,
 * which can hide conflicting metadata advertisements).
 */
export function assertMachineTokenDiscoveryJsonNoDuplicateKeys(text: string): void {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) {
    throw discoveryError("Machine-token discovery metadata must be a JSON object");
  }
  const seen = new Set<string>();
  let depth = 0;
  let inString = false;
  let escaping = false;
  let pendingKey = false;
  let keyStart = -1;

  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i]!;
    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (ch === "\\") {
        escaping = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
        if (pendingKey && depth === 1 && keyStart >= 0) {
          let key: string;
          try {
            key = JSON.parse(trimmed.slice(keyStart, i + 1)) as string;
          } catch (cause) {
            throw discoveryError(
              "Machine-token discovery metadata contains an invalid JSON key",
              cause,
            );
          }
          if (seen.has(key)) {
            throw discoveryError(
              `Machine-token discovery metadata contains duplicate field "${key}"`,
            );
          }
          seen.add(key);
          pendingKey = false;
          keyStart = -1;
        }
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      if (depth === 1 && pendingKey) {
        keyStart = i;
      }
      continue;
    }
    if (ch === "{" || ch === "[") {
      depth += 1;
      if (ch === "{") {
        pendingKey = true;
      }
      continue;
    }
    if (ch === "}" || ch === "]") {
      depth -= 1;
      pendingKey = false;
      continue;
    }
    if (ch === "," && depth === 1) {
      pendingKey = true;
      continue;
    }
    if (ch === ":" && depth === 1) {
      pendingKey = false;
    }
  }
}

function assertJsonContentType(response: Response): void {
  const contentType = response.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (mediaType !== "application/json") {
    throw discoveryError("Machine-token discovery response content-type must be application/json");
  }
}

/**
 * Force redirect:manual on injected fetch so 3xx responses surface for the
 * post-fetch reject check (do not throw here — network wraps fetch errors).
 */
function wrapFetchManualRedirect(fetchFn: MachineTokenFetchFn): MachineTokenFetchFn {
  return async (input, init) =>
    await fetchFn(input, {
      ...init,
      redirect: "manual",
    });
}

/**
 * Validate authorization-server metadata for the frozen Phase-1 PACI path.
 *
 * Enforces exact issuer match (no trailing-slash normalization), required
 * same-origin HTTPS token/JWKS/introspection endpoints, omitted
 * authorization_endpoint (reject null or any value), exact grant/auth/signing
 * arrays, required empty response_types_supported, and exact introspection
 * auth methods.
 */
export function validateMachineTokenAuthorizationServerMetadata(params: {
  metadata: unknown;
  issuerUrl: string;
  localTest?: boolean;
  allowPrivateNetwork?: boolean;
}): MachineTokenAuthorizationServerMetadata {
  const issuer = assertMachineTokenIssuerUrl(params.issuerUrl, params.localTest);
  if (!params.metadata || typeof params.metadata !== "object" || Array.isArray(params.metadata)) {
    throw discoveryError("Machine-token discovery metadata must be a JSON object");
  }
  const raw = params.metadata as Record<string, unknown>;

  if (typeof raw.issuer !== "string" || raw.issuer.length === 0) {
    throw discoveryError("Machine-token discovery metadata is missing issuer");
  }
  // Exact match to configured issuer — do not strip trailing slashes from reported.
  if (raw.issuer !== params.issuerUrl) {
    throw discoveryError(
      "Machine-token discovery metadata issuer does not match configured issuer",
    );
  }

  // Omitted entirely — reject null, empty string, or any present value.
  if ("authorization_endpoint" in raw) {
    throw discoveryError(
      "Machine-token discovery metadata must omit authorization_endpoint (null or any value is rejected)",
    );
  }

  if (typeof raw.token_endpoint !== "string" || raw.token_endpoint.length === 0) {
    throw discoveryError("Machine-token discovery metadata is missing token_endpoint");
  }
  if (typeof raw.jwks_uri !== "string" || raw.jwks_uri.length === 0) {
    throw discoveryError("Machine-token discovery metadata is missing jwks_uri");
  }
  if (typeof raw.introspection_endpoint !== "string" || raw.introspection_endpoint.length === 0) {
    throw discoveryError("Machine-token discovery metadata is missing introspection_endpoint");
  }

  assertSameOriginEndpoint({
    issuer,
    endpoint: raw.token_endpoint,
    label: "token_endpoint",
    localTest: params.localTest,
    allowPrivateNetwork: params.allowPrivateNetwork,
  });
  assertSameOriginEndpoint({
    issuer,
    endpoint: raw.jwks_uri,
    label: "jwks_uri",
    localTest: params.localTest,
    allowPrivateNetwork: params.allowPrivateNetwork,
  });
  assertSameOriginEndpoint({
    issuer,
    endpoint: raw.introspection_endpoint,
    label: "introspection_endpoint",
    localTest: params.localTest,
    allowPrivateNetwork: params.allowPrivateNetwork,
  });

  const grantTypes = assertExactStringArray({
    value: raw.grant_types_supported,
    field: "grant_types_supported",
    expected: EXACT_GRANT_TYPES,
  });
  const authMethods = assertExactStringArray({
    value: raw.token_endpoint_auth_methods_supported,
    field: "token_endpoint_auth_methods_supported",
    expected: EXACT_TOKEN_AUTH_METHODS,
  });
  const signingAlgs = assertExactStringArray({
    value: raw.token_endpoint_auth_signing_alg_values_supported,
    field: "token_endpoint_auth_signing_alg_values_supported",
    expected: EXACT_SIGNING_ALGS,
  });
  const introspectionAuthMethods = assertExactStringArray({
    value: raw.introspection_endpoint_auth_methods_supported,
    field: "introspection_endpoint_auth_methods_supported",
    expected: EXACT_INTROSPECTION_AUTH_METHODS,
  });
  const responseTypes = assertExactStringArray({
    value: raw.response_types_supported,
    field: "response_types_supported",
    expected: EXACT_RESPONSE_TYPES,
  });

  const metadata: MachineTokenAuthorizationServerMetadata = {
    issuer: params.issuerUrl,
    token_endpoint: raw.token_endpoint,
    jwks_uri: raw.jwks_uri,
    introspection_endpoint: raw.introspection_endpoint,
    grant_types_supported: grantTypes,
    token_endpoint_auth_methods_supported: authMethods,
    token_endpoint_auth_signing_alg_values_supported: signingAlgs,
    introspection_endpoint_auth_methods_supported: introspectionAuthMethods,
    response_types_supported: responseTypes,
  };

  if ("scopes_supported" in raw) {
    if (!Array.isArray(raw.scopes_supported)) {
      throw discoveryError(
        "Machine-token discovery metadata scopes_supported must be an array when present",
      );
    }
    for (const entry of raw.scopes_supported) {
      if (typeof entry !== "string") {
        throw discoveryError(
          "Machine-token discovery metadata scopes_supported elements must be strings",
        );
      }
    }
    metadata.scopes_supported = raw.scopes_supported as string[];
  }
  if ("service_documentation" in raw) {
    if (typeof raw.service_documentation !== "string") {
      throw discoveryError(
        "Machine-token discovery metadata service_documentation must be a string when present",
      );
    }
    metadata.service_documentation = raw.service_documentation;
  }

  return metadata;
}

/**
 * Fetch and validate RFC 8414 authorization-server metadata for an issuer.
 *
 * Rejects redirects (production SSRF path uses maxRedirects: 0; injected fetch
 * is forced to redirect:manual and 3xx/redirected responses fail closed).
 * Rejects top-level duplicate JSON keys that would otherwise collide silently.
 */
export async function discoverMachineTokenAuthorizationServer(
  params: DiscoverMachineTokenAuthorizationServerParams,
): Promise<MachineTokenAuthorizationServerMetadata> {
  throwIfAborted(params.signal);
  const discoveryUrl = buildMachineTokenDiscoveryUrl(params.issuerUrl, params.localTest);
  const fetchFn = params.fetchFn ? wrapFetchManualRedirect(params.fetchFn) : undefined;

  let response: Response;
  let release: () => Promise<void>;
  try {
    ({ response, release } = await machineTokenNetworkFetch({
      url: discoveryUrl,
      init: {
        method: "GET",
        headers: { accept: "application/json" },
        redirect: "manual",
      },
      fetchFn,
      signal: params.signal,
      localTest: params.localTest,
      allowPrivateNetwork: params.allowPrivateNetwork,
      label: "discovery",
    }));
  } catch (cause) {
    throwIfAborted(params.signal);
    if (cause instanceof Error && cause.message.startsWith("Machine-token ")) {
      throw cause;
    }
    throw discoveryError("Machine-token discovery request failed", cause);
  }

  try {
    throwIfAborted(params.signal);
    if (response.redirected || (response.status >= 300 && response.status < 400)) {
      throw discoveryError("Machine-token discovery rejects HTTP redirects");
    }
    if (!response.ok) {
      await discardMachineTokenErrorResponseBody({
        response,
        label: "discovery",
        signal: params.signal,
      });
      throw discoveryError(describeMachineTokenHttpFailure(response.status, "discovery"));
    }

    assertJsonContentType(response);
    let buffer: Buffer;
    try {
      buffer = await readResponseWithLimit(response, MACHINE_TOKEN_MAX_RESPONSE_BYTES, {
        timeoutMs: MACHINE_TOKEN_NETWORK_TIMEOUT_MS,
        onOverflow: () => discoveryError("Machine-token discovery response exceeds size limit"),
        onTimeout: () => discoveryError("Machine-token discovery response body timed out"),
      });
    } catch (cause) {
      throwIfAborted(params.signal);
      if (cause instanceof Error && cause.message.startsWith("Machine-token ")) {
        throw cause;
      }
      throw discoveryError("Machine-token discovery response body read failed", cause);
    }

    const text = buffer.toString("utf8");
    assertMachineTokenDiscoveryJsonNoDuplicateKeys(text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch (cause) {
      throw discoveryError("Machine-token discovery response is not valid JSON", cause);
    }

    return validateMachineTokenAuthorizationServerMetadata({
      metadata: parsed,
      issuerUrl: params.issuerUrl,
      localTest: params.localTest,
      allowPrivateNetwork: params.allowPrivateNetwork,
    });
  } finally {
    await release().catch(() => undefined);
  }
}

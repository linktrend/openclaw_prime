/**
 * Generic machine-token (OAuth client_credentials + private_key_jwt) types.
 *
 * Core takes already-resolved PEM material; SecretRef resolution belongs at
 * call sites. Platform PACI draft pin is the local/fake behavioral baseline.
 */

/** SecretRef identity used only for cache-key fingerprints (never secrets). */
export type MachineTokenKeyRefIdentity = {
  source: string;
  provider: string;
  id: string;
};

/** One independent machine-token issuer binding (Brain ≠ Skills, etc.). */
export type MachineTokenBinding = {
  bindingId: string;
  /** RFC 8414 issuer: no trailing slash, no path. */
  issuerUrl: string;
  clientId: string;
  /** Resource audience hint for later phases; unused by Phase-1 mint path. */
  audience?: string;
  /** Space-delimited OAuth scope string (legacy/config form). */
  scope?: string;
  /** Explicit operation/scope list; included in binding fingerprint. */
  operations?: readonly string[];
  /** Alias for operations when callers already use scopes terminology. */
  scopes?: readonly string[];
  /** Deployment/environment partition for cache isolation. */
  environment?: string;
  /** Logical service partition (e.g. brain vs skills). */
  service?: string;
  /**
   * Preferred key identity fingerprint (hash of SecretRef source+provider+id).
   * When absent, cache keys hash resolved PEM bytes (never logged).
   */
  keyRefFingerprint?: string;
  /** Discovery URL once known; defaults to RFC 8414 well-known from issuer. */
  discoveryUrl?: string;
  /** Token endpoint once known; included in fingerprint when set. */
  tokenEndpoint?: string;
  /**
   * Explicit local-test mode: permits HTTP only for loopback hosts and relaxes
   * SSRF private/loopback blocks for that issuer. Production must leave unset.
   */
  localTest?: boolean;
  /**
   * Explicit least-privilege opt-in for HTTPS private/CGNAT/Tailscale issuers.
   * Default false. Production stage/overlay PACI must set this — never use
   * localTest for non-test environments. Does not broadly disable SSRF:
   * fetch policy pins the exact configured HTTPS origin/hostname under zero
   * redirects while metadata/link-local remain blocked.
   */
  allowPrivateNetwork?: boolean;
  /** Already-resolved SecretRef material — PKCS#8 PEM for ES256. */
  clientAssertionKeyPem: string;
};

/** Process-resolved access token ready for Authorization: Bearer. */
export type ResolvedMachineToken = {
  bindingId: string;
  /** Immutable binding fingerprint used for cache / single-flight isolation. */
  bindingFingerprint: string;
  accessToken: string;
  /** Absolute expiry as milliseconds since Unix epoch. */
  expiresAt: number;
  tokenType: "Bearer";
};

/**
 * RFC 8414 authorization-server metadata fields required for Phase-1 PACI.
 *
 * Matches Platform `buildAuthorizationServerMetadata`: exact grant/auth/signing
 * arrays, empty `response_types_supported`, and no `authorization_endpoint`.
 */
export type MachineTokenAuthorizationServerMetadata = {
  issuer: string;
  token_endpoint: string;
  jwks_uri: string;
  introspection_endpoint: string;
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  token_endpoint_auth_signing_alg_values_supported: string[];
  introspection_endpoint_auth_methods_supported: string[];
  response_types_supported: string[];
  scopes_supported?: string[];
  service_documentation?: string;
};

export type MachineTokenFetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/** Redacted health snapshot for one granted binding — never includes access tokens. */
export type MachineTokenBindingHealth = {
  pluginId: string;
  bindingId: string;
  granted: boolean;
  registered: boolean;
  cached: boolean;
  /** Present only when a cache entry exists; absolute ms epoch. */
  expiresAt?: number;
};

/**
 * Public acquire params for a host-injected plugin facade.
 *
 * Plugins supply only the granted `bindingId` plus cancellation/refresh
 * controls. Issuer, client, audience, scopes, endpoints, and key material are
 * resolved from the host-owned immutable registry — never from plugin-supplied
 * credential objects. Auth-network and clock injection (`fetchFn`, `now`) stay
 * on host-internal `resolveMachineTokenAccess` / tests only.
 */
export type MachineTokenPluginFacadeAcquireParams = {
  bindingId: string;
  signal?: AbortSignal;
  forceRefresh?: boolean;
};

/**
 * Binding-scoped acquisition / invalidation / health surface for one plugin.
 *
 * Host constructs this facade and injects it into plugins. Plugins must not
 * construct facades, choose arbitrary plugin IDs/grants, or clear global cache.
 */
export type MachineTokenPluginFacade = {
  readonly pluginId: string;
  readonly grantedBindingIds: ReadonlySet<string>;
  /**
   * Acquire a Bearer access token for a granted binding id.
   * Credential material comes from the host registry for that id.
   * Does not accept auth-network/test injection (`fetchFn`, `now`).
   */
  acquire: (params: MachineTokenPluginFacadeAcquireParams) => Promise<ResolvedMachineToken>;
  /** Invalidate one granted binding's cached access token. */
  invalidate: (bindingId: string) => void;
  /** Redacted health for one binding id (granted or not). */
  health: (bindingId: string) => MachineTokenBindingHealth;
  /**
   * Release this plugin's use of the facade (service stop / unload).
   * Invalidates granted binding caches and fail-closes later use when the host
   * does not hold a service lease. Generation retirement stays with the host
   * runtime owner, so a duplicate or stale stop cannot retire a live facade a
   * reused registry still needs.
   */
  unregister: () => void;
};

/** Frozen PACI access-token lifetime (seconds). All other positive values rejected. */
export const MACHINE_TOKEN_FROZEN_EXPIRES_IN_SECONDS = 900;

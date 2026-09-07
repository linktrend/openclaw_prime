/**
 * TEST ONLY — in-memory fake PACI authorization server.
 *
 * Exact adapter for Platform `@linktrend/platform-paci` Phase-1 behavior
 * (createMemoryPaciRuntime / createPaciServer) without a permanent OpenClaw
 * production dependency on the private workspace package.
 *
 * Serves RFC 8414 discovery, signed `paci+jwt` access tokens (ES256), JWKS,
 * and authenticated introspection via an injected fetch dispatcher.
 *
 * Never contact live Platform. Never print private keys or access tokens.
 *
 * Platform repin: freeze HEAD `0455846487d0…` / schema `7173b9f9…`; certified
 * candidate `421a35e97bc3…` is byte-identical (OCP-W20). Failed IV HEADs (do
 * not permanently repin): Wave 2 `39c46680f058…`, Wave 3 `83501b11b78b…`,
 * Wave 4 `ca027417…`, Wave 5 `fbdede7c25a9…`, Wave 6 noted `96a96f04ede8…`,
 * Wave 6 Platform `a155cbe94171…`, Wave 7 Platform `94ff0956a5d3…`, Wave 8
 * Platform `d807ad3ca253…`. Candidate ≠ live PACI issuer.
 */
import { randomUUID } from "node:crypto";
import {
  decodeProtectedHeader,
  importPKCS8,
  importSPKI,
  jwtVerify,
  SignJWT,
  type JWK,
  type JWTPayload,
  type JWTHeaderParameters,
} from "jose";
import {
  AUTH_CLAIMS_CLAIM_KEY,
  CLIENT_ASSERTION_MAX_TTL_SECONDS,
  CLIENT_ASSERTION_TYPE,
  FORBIDDEN_ALGS,
  FORBIDDEN_HEADER_KEY_PARAMS,
  PACI_ALG,
  PACI_FAKE_ACCESS_TOKEN_EXPIRES_IN_SECONDS,
  PACI_JWT_TYP,
  PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION,
} from "./constants.js";
import { createPaciFakeEs256KeyPair, type PaciFakeEs256KeyPair } from "./keys.js";
import {
  buildPaciFakeAuthorizationServerMetadata,
  DEFAULT_ENDPOINT_PATHS,
  type PaciFakeAuthorizationServerMetadata,
} from "./metadata.js";
import { formatScopeString, PaciFakeScopeError, resolveGrantedServiceScopes } from "./scope.js";

export { PACI_FAKE_ACCESS_TOKEN_EXPIRES_IN_SECONDS } from "./constants.js";

/** Domain enum mirrored from Platform `paci_domain`. */
export type PaciFakeDomain = "lbrain" | "lskills" | "linkplatform";

/**
 * Introspection authorization policy for a resource-server client.
 * Caller eligibility is evaluated independently from the token subject / minting client.
 */
export type PaciFakeIntrospectionPolicy = {
  /**
   * When false, the client may not introspect (exact `{active:false}`).
   * Must be explicitly true — never a reconstruction default to true.
   */
  allowIntrospection: boolean;
  /** Token-minting client domains this caller may introspect. */
  allowedTokenDomains: readonly PaciFakeDomain[];
  /** Token audiences this caller may introspect (set intersection). */
  allowedTokenAudiences: readonly string[];
  /** Explicit token-minting client_ids allowed (optional fine grain). */
  allowedTokenClientIds: readonly string[];
};

/** Empty deny-all introspection policy (fail closed). */
export function denyAllIntrospectionPolicy(): PaciFakeIntrospectionPolicy {
  return {
    allowIntrospection: false,
    allowedTokenDomains: [],
    allowedTokenAudiences: [],
    allowedTokenClientIds: [],
  };
}

/** Test knobs that force non-contract minting for negative proofs. */
export type PaciFakeMintOverrides = {
  /** Force header alg (default ES256). */
  alg?: string;
  /** Force header typ (default paci+jwt). */
  typ?: string;
  /** Force JWT iss claim (default issuerUrl). */
  issuer?: string;
  /** Force AuthClaims.issuer mismatch vs JWT iss. */
  claimsIssuer?: string;
  /** Force nbf = iat + offsetSeconds (default 0 → nbf===iat). */
  nbfOffsetSeconds?: number;
  /** Inject an unknown top-level JWT claim (envelope reject). */
  extraPayloadField?: string;
  /** Force audience list. */
  audience?: string[];
  /** Force actorKind / environment-ish claim fields. */
  actorKind?: "service" | "persona" | "human";
  /** Force orgId (null for service default). */
  orgId?: string | null;
  /** Wrong claimContractVersion. */
  claimContractVersion?: string;
};

/** HTTP fault injection for timeout / 429 / 5xx proofs. */
export type PaciFakeHttpFault = {
  /** Delay every matching response (ms). */
  delayMs?: number;
  /** Override status for discovery GET. */
  discoveryStatus?: number;
  /** Override status for JWKS GET. */
  jwksStatus?: number;
  /** Override status for token POST. */
  tokenStatus?: number;
  /** Override status for introspect POST. */
  introspectStatus?: number;
  /** Optional OAuth error body code when status override is set. */
  error?: string;
  /** Optional error_description. */
  errorDescription?: string;
};

export type PaciFakeRegisterClientInput = {
  clientId: string;
  clientPublicKeyPem: string;
  domain: PaciFakeDomain;
  /** Authoritative credential serviceScopes (default [domain mapped scope]). */
  serviceScopes?: string[];
  audience?: string[];
  permittedOperations?: string[];
  actorId?: string;
  runtimeBindingId?: string;
  credentialId?: string;
  /**
   * Convenience mirror — when true without an explicit policy, grants own-domain
   * introspection. Prefer `introspectionPolicy` for resource clients.
   */
  allowIntrospection?: boolean;
  introspectionPolicy?: Partial<PaciFakeIntrospectionPolicy>;
};

export type PaciFakeServerOptions = {
  /** Issuer origin without trailing slash or path (e.g. https://paci.test). */
  issuerUrl: string;
  /** Expected OAuth client_id (primary / minting client). */
  clientId: string;
  /** Client public key used to verify private_key_jwt assertions. */
  clientPublicKeyPem: string;
  /** Optional server signing keypair for JWKS (TEST ONLY). */
  serverKeys?: PaciFakeEs256KeyPair;
  /** Override expires_in (seconds). Defaults to 900. */
  expiresInSeconds?: number;
  /**
   * When true, metadata omits private_key_jwt (interactive-only denial fixture).
   */
  omitPrivateKeyJwt?: boolean;
  /**
   * When true, metadata omits client_credentials (interactive-only denial).
   */
  omitClientCredentials?: boolean;
  /**
   * When true, token responses include a refresh_token (client must reject).
   * Platform Phase-1 issues no refresh — this is a negative fixture only.
   */
  includeRefreshToken?: boolean;
  /** Optional fixed token-endpoint path (default /oauth/token). */
  tokenPath?: string;
  /** Injected clock (ms epoch) for assertion/token lifetime checks. */
  now?: () => number;
  /** Default audience embedded in minted tokens. */
  audience?: string[];
  /** Default service scopes. */
  serviceScopes?: string[];
  /** Default permitted operations. */
  permittedOperations?: string[];
  /** Actor id (defaults to actor-<clientId>). */
  actorId?: string;
  /** Runtime binding id. */
  runtimeBindingId?: string;
  /** Credential id. */
  credentialId?: string;
  /** Domain of the primary client (default inferred from serviceScopes). */
  domain?: PaciFakeDomain;
  /**
   * Whether this client may introspect (default true).
   * Prefer `introspectionPolicy` for resource-server ACL tests.
   */
  allowIntrospection?: boolean;
  /** Authoritative introspection policy for the primary client. */
  introspectionPolicy?: Partial<PaciFakeIntrospectionPolicy>;
  /** Initial mint overrides for negative proofs. */
  mintOverrides?: PaciFakeMintOverrides;
  /** Initial HTTP fault knobs. */
  httpFault?: PaciFakeHttpFault;
};

export type PaciFakeServer = {
  issuerUrl: string;
  discoveryUrl: string;
  tokenEndpoint: string;
  jwksUrl: string;
  introspectionUrl: string;
  /** Exact RFC 8414 metadata object currently served. */
  metadata: PaciFakeAuthorizationServerMetadata;
  /** Injected fetch dispatcher covering this fake's origin. */
  fetchFn: typeof fetch;
  /** Count of successful token mints (not discovery). */
  tokenRequestCount: () => number;
  /** Invalidate one issued access token (resource 401 simulation). */
  revokeAccessToken: (accessToken: string) => void;
  /** Invalidate every issued access token for this fake. */
  revokeAllAccessTokens: () => void;
  /** Mark the primary client suspended so new mints fail. */
  suspendClient: (clientId?: string) => void;
  /** Clear assertion jti replay set (test isolation). */
  clearAssertionReplay: () => void;
  /** Whether an access token is currently considered active. */
  isAccessTokenActive: (accessToken: string) => boolean;
  /**
   * Register an additional OAuth client (token-minting or resource-server).
   * Enables token/resource-client separation and cross-domain ACL counterprobes.
   */
  registerClient: (input: PaciFakeRegisterClientInput) => Promise<void>;
  /**
   * Rotate AS signing keys. New mints use `next`; JWKS publishes both until
   * `dropPrevious` is true (previous kid removed). Tokens signed with a dropped
   * kid introspect inactive (fail closed).
   */
  rotateSigningKeys: (options?: {
    next?: PaciFakeEs256KeyPair;
    dropPrevious?: boolean;
  }) => Promise<PaciFakeEs256KeyPair>;
  /** Replace mint overrides for subsequent token responses. */
  setMintOverrides: (overrides: PaciFakeMintOverrides | undefined) => void;
  /** Replace HTTP fault knobs. */
  setHttpFault: (fault: PaciFakeHttpFault | undefined) => void;
  /** Current published JWKS keys (public only). */
  getJwks: () => { keys: JWK[] };
  /**
   * Sign a private_key_jwt for token or introspect (TEST ONLY helper).
   * Uses the registered client private key when `clientPrivateKeyPem` is given.
   */
  signClientAssertion: (input: {
    audience: string;
    clientPrivateKeyPem: string;
    clientId?: string;
    ttlSeconds?: number;
    jti?: string;
    kid?: string;
    alg?: string;
  }) => Promise<string>;
};

type RegisteredClient = {
  clientId: string;
  publicKey: CryptoKey;
  domain: PaciFakeDomain;
  serviceScopes: string[];
  audience: string[];
  permittedOperations: string[];
  actorId: string;
  credentialId: string;
  runtimeBindingId: string;
  status: "active" | "disabled";
  introspectionPolicy: PaciFakeIntrospectionPolicy;
};

type IssuedToken = {
  accessToken: string;
  clientId: string;
  clientDomain: PaciFakeDomain;
  jti: string;
  kid: string;
  actorId: string;
  credentialId: string;
  runtimeBindingId: string;
  issuer: string;
  audience: string[];
  scope: string;
  serviceScopes: string[];
  iat: number;
  expiresAt: number;
  revoked: boolean;
};

type SigningSlot = {
  kid: string;
  privateKey: CryptoKey;
  publicJwk: JWK;
};

/** RFC 4122 UUID (versions 1–8, variant 10xx) — same bar as access-token jti. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function oauthError(error: string, status: number, description?: string): Response {
  return jsonResponse(
    {
      error,
      ...(description ? { error_description: description } : {}),
    },
    status,
  );
}

function normalizeToWholeSecondUtc(nowMs: number): { iso: string; unixSeconds: number } {
  const flooredMs = Math.floor(nowMs / 1000) * 1000;
  const unixSeconds = flooredMs / 1000;
  return {
    iso: new Date(flooredMs).toISOString().replace(/\.\d{3}Z$/u, ".000Z"),
    unixSeconds,
  };
}

function rejectForbiddenAssertionHeader(header: Record<string, unknown>): string | undefined {
  const alg = header.alg;
  if (typeof alg !== "string" || FORBIDDEN_ALGS.has(alg) || alg !== PACI_ALG) {
    return `Unsupported or forbidden alg: ${String(alg)}`;
  }
  for (const param of FORBIDDEN_HEADER_KEY_PARAMS) {
    if (param in header) {
      return `Forbidden header parameter: ${param}`;
    }
  }
  return undefined;
}

function inferDomain(serviceScopes: readonly string[]): PaciFakeDomain {
  if (serviceScopes.includes("lbrain")) {
    return "lbrain";
  }
  if (serviceScopes.includes("lskills")) {
    return "lskills";
  }
  return "linkplatform";
}

function defaultScopesForDomain(domain: PaciFakeDomain): string[] {
  switch (domain) {
    case "lbrain":
      return ["lbrain"];
    case "lskills":
      return ["lskills"];
    case "linkplatform":
      return ["linkplatform"];
    default: {
      const exhaustive: never = domain;
      return exhaustive;
    }
  }
}

function buildIntrospectionPolicy(input: {
  allowIntrospection?: boolean;
  introspectionPolicy?: Partial<PaciFakeIntrospectionPolicy>;
  domain: PaciFakeDomain;
  clientId: string;
  audience: readonly string[];
}): PaciFakeIntrospectionPolicy {
  const explicit = input.introspectionPolicy;
  if (explicit) {
    return {
      allowIntrospection: explicit.allowIntrospection === true,
      allowedTokenDomains: [...(explicit.allowedTokenDomains ?? [])],
      allowedTokenAudiences: [...(explicit.allowedTokenAudiences ?? [])],
      allowedTokenClientIds: [...(explicit.allowedTokenClientIds ?? [])],
    };
  }
  // Convenience path for primary clients: allowIntrospection defaults true and
  // grants own-domain / own-audience / own-clientId so existing single-client
  // tests keep working. Explicit policy always fail-closes empty lists.
  const allow = input.allowIntrospection !== false;
  if (!allow) {
    return denyAllIntrospectionPolicy();
  }
  return {
    allowIntrospection: true,
    allowedTokenDomains: [input.domain],
    allowedTokenAudiences: [...input.audience],
    allowedTokenClientIds: [input.clientId],
  };
}

/**
 * Resource-server caller eligibility — independent of token subject.
 * Fail closed on any domain / audience / minting-client mismatch.
 */
function callerMayIntrospectToken(caller: RegisteredClient, token: IssuedToken): boolean {
  const policy = caller.introspectionPolicy;
  if (!policy.allowIntrospection) {
    return false;
  }
  if (!policy.allowedTokenDomains.includes(token.clientDomain)) {
    return false;
  }
  if (policy.allowedTokenAudiences.length > 0) {
    const tokenAud = new Set(token.audience);
    if (!policy.allowedTokenAudiences.some((aud) => tokenAud.has(aud))) {
      return false;
    }
  } else {
    return false;
  }
  if (policy.allowedTokenClientIds.length > 0) {
    if (!policy.allowedTokenClientIds.includes(token.clientId)) {
      return false;
    }
  } else {
    return false;
  }
  return true;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Create a deterministic in-memory fake PACI server for machine-token tests.
 */
export async function createPaciFakeServer(
  options: PaciFakeServerOptions,
): Promise<PaciFakeServer> {
  const issuerUrl = options.issuerUrl.replace(/\/$/u, "");
  const tokenPath = options.tokenPath ?? DEFAULT_ENDPOINT_PATHS.tokenPath;
  const expiresInSeconds = options.expiresInSeconds ?? PACI_FAKE_ACCESS_TOKEN_EXPIRES_IN_SECONDS;
  const initialServerKeys = options.serverKeys ?? (await createPaciFakeEs256KeyPair());
  const now = options.now ?? Date.now;

  const primaryServiceScopes = [...(options.serviceScopes ?? ["linkplatform"])];
  const primaryAudience = [...(options.audience ?? ["linkplatform-api"])];
  const primaryDomain = options.domain ?? inferDomain(primaryServiceScopes);
  const primaryPolicy = buildIntrospectionPolicy({
    allowIntrospection: options.allowIntrospection,
    introspectionPolicy: options.introspectionPolicy,
    domain: primaryDomain,
    clientId: options.clientId,
    audience: primaryAudience,
  });

  const clients = new Map<string, RegisteredClient>();
  clients.set(options.clientId, {
    clientId: options.clientId,
    publicKey: await importSPKI(options.clientPublicKeyPem, PACI_ALG),
    domain: primaryDomain,
    serviceScopes: primaryServiceScopes,
    audience: primaryAudience,
    permittedOperations: [...(options.permittedOperations ?? ["read", "execute"])],
    actorId: options.actorId ?? `actor-${options.clientId}`,
    credentialId: options.credentialId ?? `cred-${options.clientId}`,
    runtimeBindingId: options.runtimeBindingId ?? `bind-${options.clientId}`,
    status: "active",
    introspectionPolicy: primaryPolicy,
  });

  const metadata = buildPaciFakeAuthorizationServerMetadata({
    issuer: issuerUrl,
    paths: { tokenPath },
    omitPrivateKeyJwt: options.omitPrivateKeyJwt,
    omitClientCredentials: options.omitClientCredentials,
  });

  const discoveryUrl = `${issuerUrl}${DEFAULT_ENDPOINT_PATHS.metadataPath}`;
  const tokenEndpoint = metadata.token_endpoint;
  const jwksUrl = metadata.jwks_uri;
  const introspectionUrl = metadata.introspection_endpoint;

  const seenAssertionJtis = new Map<string, number>();
  const issuedTokens = new Map<string, IssuedToken>();
  let tokenRequestCount = 0;
  let mintOverrides: PaciFakeMintOverrides | undefined = options.mintOverrides;
  let httpFault: PaciFakeHttpFault | undefined = options.httpFault;

  let activeSigning: SigningSlot = {
    kid: initialServerKeys.kid,
    privateKey: initialServerKeys.privateKey,
    publicJwk: initialServerKeys.publicJwk,
  };
  const publishedSigning = new Map<string, SigningSlot>([[activeSigning.kid, activeSigning]]);

  function pruneAssertionJtis(nowUnix: number): void {
    for (const [jti, exp] of seenAssertionJtis) {
      if (exp <= nowUnix) {
        seenAssertionJtis.delete(jti);
      }
    }
  }

  async function verifyClientAssertion(
    assertion: string,
    expectedAud: string,
  ): Promise<{ client: RegisteredClient; jti: string } | Response> {
    let header: Record<string, unknown>;
    try {
      header = decodeProtectedHeader(assertion) as Record<string, unknown>;
    } catch {
      return oauthError("invalid_client", 401, "malformed client assertion");
    }
    const headerErr = rejectForbiddenAssertionHeader(header);
    if (headerErr) {
      return oauthError("invalid_client", 401, headerErr);
    }

    let unverified: JWTPayload;
    try {
      const parts = assertion.split(".");
      if (parts.length !== 3) {
        throw new Error("not compact");
      }
      unverified = JSON.parse(
        Buffer.from(parts[1] ?? "", "base64url").toString("utf8"),
      ) as JWTPayload;
    } catch {
      return oauthError("invalid_client", 401, "malformed client assertion payload");
    }

    const clientId = typeof unverified.sub === "string" ? unverified.sub : undefined;
    if (!clientId || unverified.iss !== clientId) {
      return oauthError("invalid_client", 401, "iss/sub mismatch");
    }

    const client = clients.get(clientId);
    if (!client || client.status !== "active") {
      return oauthError("invalid_client", 401, "unknown or inactive client");
    }

    const nowUnix = Math.floor(now() / 1000);
    try {
      const result = await jwtVerify(assertion, client.publicKey, {
        algorithms: [PACI_ALG],
        audience: expectedAud,
        clockTolerance: 0,
        maxTokenAge: `${CLIENT_ASSERTION_MAX_TTL_SECONDS}s`,
        currentDate: new Date(now()),
      });
      const payload = result.payload;
      if (payload.iss !== clientId || payload.sub !== clientId) {
        return oauthError("invalid_client", 401, "iss/sub mismatch");
      }
      if (typeof payload.exp !== "number" || typeof payload.iat !== "number") {
        return oauthError("invalid_client", 401, "missing iat/exp");
      }
      if (payload.exp - payload.iat > CLIENT_ASSERTION_MAX_TTL_SECONDS) {
        return oauthError("invalid_client", 401, "assertion lifetime exceeds 5 minutes");
      }
      if (payload.exp <= nowUnix) {
        return oauthError("invalid_client", 401, "assertion expired");
      }
      const jti = payload.jti;
      if (typeof jti !== "string" || !UUID_RE.test(jti)) {
        return oauthError("invalid_client", 401, "client assertion jti must be an RFC 4122 UUID");
      }
      pruneAssertionJtis(nowUnix);
      if (seenAssertionJtis.has(jti)) {
        return oauthError("invalid_client", 401, "assertion jti replay");
      }
      seenAssertionJtis.set(jti, payload.exp);
      return { client, jti };
    } catch {
      return oauthError("invalid_client", 401, "invalid client_assertion");
    }
  }

  async function mintAccessToken(
    client: RegisteredClient,
    requestedScope?: string,
  ): Promise<
    | {
        access_token: string;
        token_type: "Bearer";
        expires_in: number;
      }
    | Response
  > {
    let grantedScopes: readonly string[];
    try {
      grantedScopes = resolveGrantedServiceScopes({
        credentialServiceScopes: client.serviceScopes,
        requestedScope,
      });
    } catch (err) {
      if (err instanceof PaciFakeScopeError) {
        return oauthError(err.code, err.httpStatus, err.message);
      }
      throw err;
    }

    const issued = normalizeToWholeSecondUtc(now());
    const expires = normalizeToWholeSecondUtc((issued.unixSeconds + expiresInSeconds) * 1000);
    const jti = randomUUID();
    const correlationId = `mint-${randomUUID()}`;
    const overrides = mintOverrides ?? {};
    const tokenAudience = overrides.audience ?? client.audience;
    const claimsIssuer = overrides.claimsIssuer ?? overrides.issuer ?? issuerUrl;
    const jwtIssuer = overrides.issuer ?? issuerUrl;
    const actorKind = overrides.actorKind ?? "service";
    const orgId =
      overrides.orgId === undefined
        ? actorKind === "service"
          ? null
          : "org-test"
        : overrides.orgId;
    const nbf = issued.unixSeconds + (overrides.nbfOffsetSeconds ?? 0);
    const scopeString = formatScopeString(grantedScopes);

    const claims: Record<string, unknown> = {
      claimContractVersion: overrides.claimContractVersion ?? PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION,
      actorId: client.actorId,
      actorKind,
      runtimeBindingId: client.runtimeBindingId,
      credentialId: client.credentialId,
      orgId,
      internal: true,
      serviceScopes: [...grantedScopes],
      permittedOperations: [...client.permittedOperations],
      issuedAt: issued.iso,
      expiresAt: expires.iso,
      issuer: claimsIssuer,
      audience: [...tokenAudience],
      correlationId,
    };

    const payload: Record<string, unknown> = {
      [AUTH_CLAIMS_CLAIM_KEY]: claims,
    };
    if (overrides.extraPayloadField) {
      payload[overrides.extraPayloadField] = "not-allowed";
    }

    const alg = overrides.alg ?? PACI_ALG;
    const typ = overrides.typ ?? PACI_JWT_TYP;

    const accessToken = await new SignJWT(payload)
      .setProtectedHeader({
        alg,
        typ,
        kid: activeSigning.kid,
      })
      .setIssuer(jwtIssuer)
      .setSubject(client.actorId)
      .setAudience([...tokenAudience])
      .setIssuedAt(issued.unixSeconds)
      .setNotBefore(nbf)
      .setExpirationTime(expires.unixSeconds)
      .setJti(jti)
      .sign(activeSigning.privateKey);

    issuedTokens.set(accessToken, {
      accessToken,
      clientId: client.clientId,
      clientDomain: client.domain,
      jti,
      kid: activeSigning.kid,
      actorId: client.actorId,
      credentialId: client.credentialId,
      runtimeBindingId: client.runtimeBindingId,
      issuer: jwtIssuer,
      audience: [...tokenAudience],
      scope: scopeString,
      serviceScopes: [...grantedScopes],
      iat: issued.unixSeconds,
      expiresAt: expires.unixSeconds * 1000,
      revoked: false,
    });

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresInSeconds,
    };
  }

  async function handleToken(request: Request): Promise<Response> {
    tokenRequestCount += 1;
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/x-www-form-urlencoded")) {
      return oauthError("invalid_request", 400, "expected form body");
    }
    const form = new URLSearchParams(await request.text());
    if (form.get("grant_type") !== "client_credentials") {
      return oauthError("unsupported_grant_type", 400);
    }
    if (form.get("client_assertion_type") !== CLIENT_ASSERTION_TYPE) {
      return oauthError("invalid_client", 401, "private_key_jwt required");
    }
    const assertion = form.get("client_assertion");
    if (!assertion) {
      return oauthError("invalid_client", 401, "missing client_assertion");
    }

    const verified = await verifyClientAssertion(assertion, tokenEndpoint);
    if (verified instanceof Response) {
      return verified;
    }

    const minted = await mintAccessToken(verified.client, form.get("scope") ?? undefined);
    if (minted instanceof Response) {
      return minted;
    }
    const body: Record<string, unknown> = {
      access_token: minted.access_token,
      token_type: minted.token_type,
      expires_in: minted.expires_in,
    };
    if (options.includeRefreshToken) {
      body.refresh_token = `paci-fake-rt-${randomUUID()}`;
    }
    return jsonResponse(body);
  }

  async function handleIntrospect(request: Request): Promise<Response> {
    const form = new URLSearchParams(await request.text());
    if (
      form.get("client_assertion_type") !== CLIENT_ASSERTION_TYPE ||
      !form.get("client_assertion")
    ) {
      return oauthError("invalid_client", 401, "private_key_jwt required for introspection");
    }

    const verified = await verifyClientAssertion(form.get("client_assertion")!, introspectionUrl);
    if (verified instanceof Response) {
      // Invalid / unknown / inactive client → 401 (never silent inactive).
      return verified;
    }

    const caller = verified.client;
    if (!caller.introspectionPolicy.allowIntrospection) {
      return jsonResponse({ active: false });
    }

    const token = form.get("token") ?? "";
    const issued = issuedTokens.get(token);
    const nowMs = now();
    if (!issued || issued.revoked || issued.expiresAt <= nowMs) {
      return jsonResponse({ active: false });
    }

    // Signing-key rotation with dropPrevious → kid absent → fail closed inactive.
    if (!publishedSigning.has(issued.kid)) {
      return jsonResponse({ active: false });
    }

    const mintingClient = clients.get(issued.clientId);
    if (!mintingClient || mintingClient.status !== "active") {
      return jsonResponse({ active: false });
    }

    // Cross-domain / audience / minting-client ACL — fail closed, no disclosure.
    if (!callerMayIntrospectToken(caller, issued)) {
      return jsonResponse({ active: false });
    }

    const expectedScope = formatScopeString(issued.serviceScopes);
    const scope = issued.scope === expectedScope ? issued.scope : expectedScope;

    return jsonResponse({
      active: true,
      iss: issued.issuer,
      aud: issued.audience.length === 1 ? issued.audience[0]! : [...issued.audience],
      sub: issued.actorId,
      exp: Math.floor(issued.expiresAt / 1000),
      iat: issued.iat,
      jti: issued.jti,
      // Minting client_id — never the resource-server introspection caller.
      client_id: issued.clientId,
      scope,
      credential_id: issued.credentialId,
      runtime_binding_id: issued.runtimeBindingId,
      token_type: "Bearer",
    });
  }

  function faultOverride(status: number | undefined): Response | undefined {
    if (status === undefined) {
      return undefined;
    }
    if (status >= 400) {
      return oauthError(httpFault?.error ?? "server_error", status, httpFault?.errorDescription);
    }
    return jsonResponse({ ok: true }, status);
  }

  const fetchFn: typeof fetch = async (input, init) => {
    if (httpFault?.delayMs && httpFault.delayMs > 0) {
      await sleep(httpFault.delayMs);
    }
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    if (url.origin !== new URL(issuerUrl).origin) {
      return new Response("not found", { status: 404 });
    }
    if (url.pathname === DEFAULT_ENDPOINT_PATHS.metadataPath && request.method === "GET") {
      const faulted = faultOverride(httpFault?.discoveryStatus);
      if (faulted) {
        return faulted;
      }
      return jsonResponse(metadata);
    }
    if (url.pathname === DEFAULT_ENDPOINT_PATHS.jwksPath && request.method === "GET") {
      const faulted = faultOverride(httpFault?.jwksStatus);
      if (faulted) {
        return faulted;
      }
      return jsonResponse({
        keys: [...publishedSigning.values()].map((slot) => slot.publicJwk),
      });
    }
    if (url.pathname === tokenPath && request.method === "POST") {
      const faulted = faultOverride(httpFault?.tokenStatus);
      if (faulted) {
        return faulted;
      }
      return await handleToken(request);
    }
    if (url.pathname === DEFAULT_ENDPOINT_PATHS.introspectPath && request.method === "POST") {
      const faulted = faultOverride(httpFault?.introspectStatus);
      if (faulted) {
        return faulted;
      }
      return await handleIntrospect(request);
    }
    return new Response("not found", { status: 404 });
  };

  return {
    issuerUrl,
    discoveryUrl,
    tokenEndpoint,
    jwksUrl,
    introspectionUrl,
    metadata,
    fetchFn,
    tokenRequestCount: () => tokenRequestCount,
    revokeAccessToken: (accessToken) => {
      const issued = issuedTokens.get(accessToken);
      if (issued) {
        issued.revoked = true;
      }
    },
    revokeAllAccessTokens: () => {
      for (const issued of issuedTokens.values()) {
        issued.revoked = true;
      }
    },
    suspendClient: (clientId) => {
      const target = clients.get(clientId ?? options.clientId);
      if (target) {
        target.status = "disabled";
      }
    },
    clearAssertionReplay: () => {
      seenAssertionJtis.clear();
    },
    isAccessTokenActive: (accessToken) => {
      const issued = issuedTokens.get(accessToken);
      return Boolean(
        issued && !issued.revoked && issued.expiresAt > now() && publishedSigning.has(issued.kid),
      );
    },
    async registerClient(input) {
      if (clients.has(input.clientId)) {
        throw new Error(`Client already registered: ${input.clientId}`);
      }
      const serviceScopes = [...(input.serviceScopes ?? defaultScopesForDomain(input.domain))];
      const audience = [...(input.audience ?? [`${input.domain}-api`])];
      const policy = buildIntrospectionPolicy({
        allowIntrospection: input.allowIntrospection,
        introspectionPolicy: input.introspectionPolicy,
        domain: input.domain,
        clientId: input.clientId,
        audience,
      });
      clients.set(input.clientId, {
        clientId: input.clientId,
        publicKey: await importSPKI(input.clientPublicKeyPem, PACI_ALG),
        domain: input.domain,
        serviceScopes,
        audience,
        permittedOperations: [...(input.permittedOperations ?? ["read", "execute"])],
        actorId: input.actorId ?? `actor-${input.clientId}`,
        credentialId: input.credentialId ?? `cred-${input.clientId}`,
        runtimeBindingId: input.runtimeBindingId ?? `bind-${input.clientId}`,
        status: "active",
        introspectionPolicy: policy,
      });
    },
    async rotateSigningKeys(rotateOptions = {}) {
      const next =
        rotateOptions.next ??
        (await createPaciFakeEs256KeyPair({
          kid: `paci-fake-rotated-${randomUUID()}`,
          reuse: false,
        }));
      activeSigning = {
        kid: next.kid,
        privateKey: next.privateKey,
        publicJwk: next.publicJwk,
      };
      publishedSigning.set(activeSigning.kid, activeSigning);
      if (rotateOptions.dropPrevious) {
        for (const kid of publishedSigning.keys()) {
          if (kid !== activeSigning.kid) {
            publishedSigning.delete(kid);
          }
        }
      }
      return next;
    },
    setMintOverrides: (overrides) => {
      mintOverrides = overrides;
    },
    setHttpFault: (fault) => {
      httpFault = fault;
    },
    getJwks: () => ({
      keys: [...publishedSigning.values()].map((slot) => slot.publicJwk),
    }),
    async signClientAssertion(input) {
      const key = await importPKCS8(input.clientPrivateKeyPem, PACI_ALG);
      const nowUnix = Math.floor(now() / 1000);
      const ttl = Math.min(
        input.ttlSeconds ?? CLIENT_ASSERTION_MAX_TTL_SECONDS,
        CLIENT_ASSERTION_MAX_TTL_SECONDS,
      );
      const header: JWTHeaderParameters = {
        alg: input.alg ?? PACI_ALG,
      };
      if (input.kid) {
        header.kid = input.kid;
      }
      const assertionClientId = input.clientId ?? options.clientId;
      return new SignJWT({})
        .setProtectedHeader(header)
        .setIssuer(assertionClientId)
        .setSubject(assertionClientId)
        .setAudience(input.audience)
        .setIssuedAt(nowUnix)
        .setExpirationTime(nowUnix + ttl)
        .setJti(input.jti ?? randomUUID())
        .sign(key);
    },
  };
}

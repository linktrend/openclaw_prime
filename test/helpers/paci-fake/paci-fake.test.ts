/**
 * TEST ONLY — Platform PACI parity proofs for the OpenClaw paci-fake adapter.
 */
import { decodeProtectedHeader, exportSPKI, importSPKI, jwtVerify } from "jose";
import { describe, expect, it } from "vitest";
import {
  AUTH_CLAIMS_CLAIM_KEY,
  CLIENT_ASSERTION_TYPE,
  PACI_ALG,
  PACI_FAKE_ACCESS_TOKEN_EXPIRES_IN_SECONDS,
  PACI_JWT_TYP,
  PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION,
} from "./constants.js";
import { createPaciFakeEs256KeyPair } from "./keys.js";
import { buildPaciFakeAuthorizationServerMetadata } from "./metadata.js";
import { createPaciFakeServer } from "./server.js";

const ISSUER = "https://paci.test";
const CLIENT_ID = "openclaw-test-client";
const REPLAY_JTI = "550e8400-e29b-41d4-a716-4466554400ac";

async function mintForm(assertion: string, scope?: string): Promise<URLSearchParams> {
  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_assertion_type: CLIENT_ASSERTION_TYPE,
    client_assertion: assertion,
  });
  if (scope) {
    form.set("scope", scope);
  }
  return form;
}

async function introspectForm(token: string, assertion: string): Promise<URLSearchParams> {
  return new URLSearchParams({
    token,
    client_assertion_type: CLIENT_ASSERTION_TYPE,
    client_assertion: assertion,
  });
}

describe("paci-fake Platform parity", () => {
  it("pins Phase-1 TTL at 900s with no refresh by default", () => {
    expect(PACI_FAKE_ACCESS_TOKEN_EXPIRES_IN_SECONDS).toBe(900);
  });

  it("builds RFC 8414 metadata matching Platform (omit authorization_endpoint)", () => {
    const metadata = buildPaciFakeAuthorizationServerMetadata({ issuer: ISSUER });
    expect(metadata).toEqual({
      issuer: ISSUER,
      token_endpoint: `${ISSUER}/oauth/token`,
      jwks_uri: `${ISSUER}/.well-known/jwks.json`,
      introspection_endpoint: `${ISSUER}/oauth/introspect`,
      grant_types_supported: ["client_credentials"],
      token_endpoint_auth_methods_supported: ["private_key_jwt"],
      token_endpoint_auth_signing_alg_values_supported: ["ES256"],
      introspection_endpoint_auth_methods_supported: ["private_key_jwt"],
      response_types_supported: [],
      scopes_supported: ["lbrain", "lskills", "linkplatform"],
    });
    expect("authorization_endpoint" in metadata).toBe(false);
  });

  it("issues signed paci+jwt access tokens with AuthClaims envelope", async () => {
    const clientKeys = await createPaciFakeEs256KeyPair({ reuse: false });
    const serverKeys = await createPaciFakeEs256KeyPair({
      kid: "paci-as-1",
      reuse: false,
    });
    const nowMs = 1_700_000_000_000;
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: clientKeys.publicKeyPem,
      serverKeys,
      now: () => nowMs,
      audience: ["lbrain-api"],
      serviceScopes: ["lbrain", "linkplatform"],
    });

    const assertion = await fake.signClientAssertion({
      audience: fake.tokenEndpoint,
      clientPrivateKeyPem: clientKeys.privateKeyPem,
    });
    const tokenRes = await fake.fetchFn(fake.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: await mintForm(assertion),
    });
    expect(tokenRes.status).toBe(200);
    const body = (await tokenRes.json()) as {
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token?: string;
    };
    expect(body.token_type).toBe("Bearer");
    expect(body.expires_in).toBe(900);
    expect(body.refresh_token).toBeUndefined();
    expect(body.access_token.split(".")).toHaveLength(3);

    const header = decodeProtectedHeader(body.access_token);
    expect(header).toMatchObject({ alg: PACI_ALG, typ: PACI_JWT_TYP, kid: "paci-as-1" });

    const verified = await jwtVerify(body.access_token, serverKeys.publicKey, {
      algorithms: [PACI_ALG],
      issuer: ISSUER,
      typ: PACI_JWT_TYP,
      currentDate: new Date(nowMs),
    });
    const payload = verified.payload as Record<string, unknown>;
    expect(payload.iss).toBe(ISSUER);
    expect(payload.aud).toEqual(["lbrain-api"]);
    expect(payload.nbf).toBe(payload.iat);
    expect(payload.exp).toBe((payload.iat as number) + 900);
    const claims = payload[AUTH_CLAIMS_CLAIM_KEY] as Record<string, unknown>;
    expect(claims.claimContractVersion).toBe(PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION);
    expect(claims.issuer).toBe(ISSUER);
    expect(claims.audience).toEqual(["lbrain-api"]);
    expect(typeof claims.correlationId).toBe("string");
  });

  it("rejects assertion jti replay (single-use)", async () => {
    const clientKeys = await createPaciFakeEs256KeyPair({ reuse: false });
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: clientKeys.publicKeyPem,
      now: () => 1_700_000_000_000,
    });
    const assertion = await fake.signClientAssertion({
      audience: fake.tokenEndpoint,
      clientPrivateKeyPem: clientKeys.privateKeyPem,
      jti: REPLAY_JTI,
    });
    const first = await fake.fetchFn(fake.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: await mintForm(assertion),
    });
    expect(first.status).toBe(200);
    const second = await fake.fetchFn(fake.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: await mintForm(assertion),
    });
    expect(second.status).toBe(401);
    const err = (await second.json()) as { error: string; error_description?: string };
    expect(err.error).toBe("invalid_client");
    expect(err.error_description).toMatch(/replay/u);
  });

  it("counterprobe: rejects non-UUID assertion jti=not-a-uuid", async () => {
    const clientKeys = await createPaciFakeEs256KeyPair({ reuse: false });
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: clientKeys.publicKeyPem,
      now: () => 1_700_000_000_000,
    });
    const assertion = await fake.signClientAssertion({
      audience: fake.tokenEndpoint,
      clientPrivateKeyPem: clientKeys.privateKeyPem,
      jti: "not-a-uuid",
    });
    const res = await fake.fetchFn(fake.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: await mintForm(assertion),
    });
    expect(res.status).toBe(401);
    const err = (await res.json()) as { error: string; error_description?: string };
    expect(err.error).toBe("invalid_client");
    expect(err.error_description).toMatch(/UUID|jti/iu);
  });

  it("counterprobe: rejects requested scope admin when client only has lbrain", async () => {
    const clientKeys = await createPaciFakeEs256KeyPair({ reuse: false });
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: "lbrain-only-client",
      clientPublicKeyPem: clientKeys.publicKeyPem,
      domain: "lbrain",
      serviceScopes: ["lbrain"],
      audience: ["lbrain-api"],
      now: () => 1_700_000_000_000,
    });
    const assertion = await fake.signClientAssertion({
      audience: fake.tokenEndpoint,
      clientPrivateKeyPem: clientKeys.privateKeyPem,
      clientId: "lbrain-only-client",
    });
    const res = await fake.fetchFn(fake.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: await mintForm(assertion, "admin"),
    });
    expect(res.status).toBe(400);
    const err = (await res.json()) as { error: string; error_description?: string };
    expect(err.error).toBe("invalid_scope");
    expect(err.error_description).toMatch(/admin/u);
  });

  it("requires authenticated introspection; invalid client → 401; inactive → 200 {active:false}", async () => {
    const clientKeys = await createPaciFakeEs256KeyPair({ reuse: false });
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: clientKeys.publicKeyPem,
      now: () => 1_700_000_000_000,
    });

    const unauth = await fake.fetchFn(fake.introspectionUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: "missing" }),
    });
    expect(unauth.status).toBe(401);

    const spoofedKeys = await createPaciFakeEs256KeyPair({ reuse: false });
    const badClientAssertion = await fake.signClientAssertion({
      audience: fake.introspectionUrl,
      clientPrivateKeyPem: spoofedKeys.privateKeyPem,
      clientId: "unknown-client",
    });
    const invalidClient = await fake.fetchFn(fake.introspectionUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: await introspectForm("unknown", badClientAssertion),
    });
    expect(invalidClient.status).toBe(401);
    expect(((await invalidClient.json()) as { error: string }).error).toBe("invalid_client");

    const assertion = await fake.signClientAssertion({
      audience: fake.introspectionUrl,
      clientPrivateKeyPem: clientKeys.privateKeyPem,
    });
    const inactive = await fake.fetchFn(fake.introspectionUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: await introspectForm("unknown", assertion),
    });
    expect(inactive.status).toBe(200);
    expect(await inactive.json()).toEqual({ active: false });
  });

  it("returns active introspection for minted tokens and inactive after revoke", async () => {
    const clientKeys = await createPaciFakeEs256KeyPair({ reuse: false });
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: clientKeys.publicKeyPem,
      now: () => 1_700_000_000_000,
    });
    const mintAssertion = await fake.signClientAssertion({
      audience: fake.tokenEndpoint,
      clientPrivateKeyPem: clientKeys.privateKeyPem,
    });
    const minted = (await (
      await fake.fetchFn(fake.tokenEndpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: await mintForm(mintAssertion),
      })
    ).json()) as { access_token: string };

    const introspectAssertion = await fake.signClientAssertion({
      audience: fake.introspectionUrl,
      clientPrivateKeyPem: clientKeys.privateKeyPem,
    });
    const active = await fake.fetchFn(fake.introspectionUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: await introspectForm(minted.access_token, introspectAssertion),
    });
    expect(active.status).toBe(200);
    const activeBody = (await active.json()) as { active: boolean; token_type?: string };
    expect(activeBody.active).toBe(true);
    expect(activeBody.token_type).toBe("Bearer");

    fake.revokeAccessToken(minted.access_token);
    const after = await fake.signClientAssertion({
      audience: fake.introspectionUrl,
      clientPrivateKeyPem: clientKeys.privateKeyPem,
    });
    const inactive = await fake.fetchFn(fake.introspectionUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: await introspectForm(minted.access_token, after),
    });
    expect(await inactive.json()).toEqual({ active: false });
  });

  it("counterprobe: cross-domain introspection fails closed with no disclosure", async () => {
    const brainMintKeys = await createPaciFakeEs256KeyPair({ reuse: false });
    const skillsResourceKeys = await createPaciFakeEs256KeyPair({ reuse: false });
    const brainResourceKeys = await createPaciFakeEs256KeyPair({ reuse: false });
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: "brain-mint-client",
      clientPublicKeyPem: brainMintKeys.publicKeyPem,
      domain: "lbrain",
      serviceScopes: ["lbrain"],
      audience: ["lbrain-api"],
      allowIntrospection: false,
      now: () => 1_700_000_000_000,
    });

    await fake.registerClient({
      clientId: "skills-resource-client",
      clientPublicKeyPem: skillsResourceKeys.publicKeyPem,
      domain: "lskills",
      serviceScopes: ["lskills"],
      audience: ["lskills-api"],
      introspectionPolicy: {
        allowIntrospection: true,
        allowedTokenDomains: ["lskills"],
        allowedTokenAudiences: ["lskills-api"],
        allowedTokenClientIds: ["skills-mint-client"],
      },
    });

    await fake.registerClient({
      clientId: "brain-resource-client",
      clientPublicKeyPem: brainResourceKeys.publicKeyPem,
      domain: "lbrain",
      serviceScopes: ["lbrain"],
      audience: ["lbrain-api"],
      introspectionPolicy: {
        allowIntrospection: true,
        allowedTokenDomains: ["lbrain"],
        allowedTokenAudiences: ["lbrain-api"],
        allowedTokenClientIds: ["brain-mint-client"],
      },
    });

    const mintAssertion = await fake.signClientAssertion({
      audience: fake.tokenEndpoint,
      clientPrivateKeyPem: brainMintKeys.privateKeyPem,
      clientId: "brain-mint-client",
    });
    const minted = (await (
      await fake.fetchFn(fake.tokenEndpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: await mintForm(mintAssertion),
      })
    ).json()) as { access_token: string };

    const skillsAssertion = await fake.signClientAssertion({
      audience: fake.introspectionUrl,
      clientPrivateKeyPem: skillsResourceKeys.privateKeyPem,
      clientId: "skills-resource-client",
    });
    const cross = await fake.fetchFn(fake.introspectionUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: await introspectForm(minted.access_token, skillsAssertion),
    });
    expect(cross.status).toBe(200);
    expect(await cross.json()).toEqual({ active: false });

    const brainAssertion = await fake.signClientAssertion({
      audience: fake.introspectionUrl,
      clientPrivateKeyPem: brainResourceKeys.privateKeyPem,
      clientId: "brain-resource-client",
    });
    const eligible = await fake.fetchFn(fake.introspectionUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: await introspectForm(minted.access_token, brainAssertion),
    });
    expect(eligible.status).toBe(200);
    const eligibleBody = (await eligible.json()) as {
      active: boolean;
      client_id?: string;
      scope?: string;
      sub?: string;
    };
    expect(eligibleBody.active).toBe(true);
    expect(eligibleBody.client_id).toBe("brain-mint-client");
    expect(eligibleBody.scope).toBe("lbrain");
  });

  it("counterprobe: token/resource-client separation (active client_id is minting client)", async () => {
    const mintKeys = await createPaciFakeEs256KeyPair({ reuse: false });
    const resourceKeys = await createPaciFakeEs256KeyPair({ reuse: false });
    const mintClientId = "token-mint-client";
    const resourceClientId = "resource-introspect-client";
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: mintClientId,
      clientPublicKeyPem: mintKeys.publicKeyPem,
      domain: "lbrain",
      serviceScopes: ["lbrain"],
      audience: ["lbrain-api"],
      allowIntrospection: false,
      now: () => 1_700_000_000_000,
    });
    await fake.registerClient({
      clientId: resourceClientId,
      clientPublicKeyPem: resourceKeys.publicKeyPem,
      domain: "lbrain",
      serviceScopes: ["lbrain"],
      audience: ["lbrain-api"],
      introspectionPolicy: {
        allowIntrospection: true,
        allowedTokenDomains: ["lbrain"],
        allowedTokenAudiences: ["lbrain-api"],
        allowedTokenClientIds: [mintClientId],
      },
    });

    const mintAssertion = await fake.signClientAssertion({
      audience: fake.tokenEndpoint,
      clientPrivateKeyPem: mintKeys.privateKeyPem,
      clientId: mintClientId,
    });
    const minted = (await (
      await fake.fetchFn(fake.tokenEndpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: await mintForm(mintAssertion),
      })
    ).json()) as { access_token: string };

    const resourceAssertion = await fake.signClientAssertion({
      audience: fake.introspectionUrl,
      clientPrivateKeyPem: resourceKeys.privateKeyPem,
      clientId: resourceClientId,
    });
    const intro = await fake.fetchFn(fake.introspectionUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: await introspectForm(minted.access_token, resourceAssertion),
    });
    const body = (await intro.json()) as {
      active: boolean;
      client_id: string;
    };
    expect(body.active).toBe(true);
    expect(body.client_id).toBe(mintClientId);
    expect(body.client_id).not.toBe(resourceClientId);
  });

  it("counterprobe: rotation dropPrevious + revocation make introspect inactive", async () => {
    const clientKeys = await createPaciFakeEs256KeyPair({ reuse: false });
    const serverKeys = await createPaciFakeEs256KeyPair({
      kid: "as-original",
      reuse: false,
    });
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: clientKeys.publicKeyPem,
      serverKeys,
      now: () => 1_700_000_000_000,
    });

    const mint1 = await fake.signClientAssertion({
      audience: fake.tokenEndpoint,
      clientPrivateKeyPem: clientKeys.privateKeyPem,
    });
    const tokenA = (await (
      await fake.fetchFn(fake.tokenEndpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: await mintForm(mint1),
      })
    ).json()) as { access_token: string };

    const rotated = await fake.rotateSigningKeys({ dropPrevious: true });
    expect(fake.getJwks().keys).toHaveLength(1);
    expect(fake.getJwks().keys[0]?.kid).toBe(rotated.kid);

    const afterRotate = await fake.signClientAssertion({
      audience: fake.introspectionUrl,
      clientPrivateKeyPem: clientKeys.privateKeyPem,
    });
    const rotatedInactive = await fake.fetchFn(fake.introspectionUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: await introspectForm(tokenA.access_token, afterRotate),
    });
    expect(await rotatedInactive.json()).toEqual({ active: false });
    expect(fake.isAccessTokenActive(tokenA.access_token)).toBe(false);

    const mint2 = await fake.signClientAssertion({
      audience: fake.tokenEndpoint,
      clientPrivateKeyPem: clientKeys.privateKeyPem,
    });
    const tokenB = (await (
      await fake.fetchFn(fake.tokenEndpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: await mintForm(mint2),
      })
    ).json()) as { access_token: string };
    expect(decodeProtectedHeader(tokenB.access_token).kid).toBe(rotated.kid);

    fake.revokeAccessToken(tokenB.access_token);
    const afterRevoke = await fake.signClientAssertion({
      audience: fake.introspectionUrl,
      clientPrivateKeyPem: clientKeys.privateKeyPem,
    });
    const revokedInactive = await fake.fetchFn(fake.introspectionUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: await introspectForm(tokenB.access_token, afterRevoke),
    });
    expect(await revokedInactive.json()).toEqual({ active: false });
  });

  it("supports mint overrides for wrong issuer/alg/claims and JWKS rotation", async () => {
    const clientKeys = await createPaciFakeEs256KeyPair({ reuse: false });
    const serverKeys = await createPaciFakeEs256KeyPair({
      kid: "as-original",
      reuse: false,
    });
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: clientKeys.publicKeyPem,
      serverKeys,
      now: () => 1_700_000_000_000,
    });

    fake.setMintOverrides({
      issuer: "https://wrong.issuer.test",
      claimsIssuer: ISSUER,
      nbfOffsetSeconds: 5,
      extraPayloadField: "role",
      claimContractVersion: "1.0.0",
    });
    const assertion = await fake.signClientAssertion({
      audience: fake.tokenEndpoint,
      clientPrivateKeyPem: clientKeys.privateKeyPem,
    });
    const bad = (await (
      await fake.fetchFn(fake.tokenEndpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: await mintForm(assertion),
      })
    ).json()) as { access_token: string };
    const badPayload = JSON.parse(
      Buffer.from(bad.access_token.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    expect(badPayload.iss).toBe("https://wrong.issuer.test");
    expect(badPayload.nbf).toBe((badPayload.iat as number) + 5);
    expect(badPayload.role).toBe("not-allowed");
    const claims = badPayload[AUTH_CLAIMS_CLAIM_KEY] as Record<string, unknown>;
    expect(claims.claimContractVersion).toBe("1.0.0");
    expect(claims.issuer).toBe(ISSUER);

    const beforeRotate = fake.getJwks().keys.map((k) => k.kid);
    expect(beforeRotate).toEqual(["as-original"]);
    const rotated = await fake.rotateSigningKeys({ dropPrevious: false });
    const afterRotate = fake
      .getJwks()
      .keys.map((k) => k.kid)
      .toSorted((a, b) => a.localeCompare(b));
    expect(afterRotate).toEqual(
      ["as-original", rotated.kid].toSorted((a, b) => a.localeCompare(b)),
    );

    fake.setMintOverrides(undefined);
    const assertion2 = await fake.signClientAssertion({
      audience: fake.tokenEndpoint,
      clientPrivateKeyPem: clientKeys.privateKeyPem,
    });
    const good = (await (
      await fake.fetchFn(fake.tokenEndpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: await mintForm(assertion2),
      })
    ).json()) as { access_token: string };
    expect(decodeProtectedHeader(good.access_token).kid).toBe(rotated.kid);

    await fake.rotateSigningKeys({ dropPrevious: true });
    expect(fake.getJwks().keys).toHaveLength(1);
  });

  it("exposes 429/5xx/timeout stubs as HTTP fault knobs", async () => {
    const clientKeys = await createPaciFakeEs256KeyPair({ reuse: false });
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: clientKeys.publicKeyPem,
    });

    fake.setHttpFault({ tokenStatus: 429, error: "temporarily_unavailable" });
    const rateLimited = await fake.fetchFn(fake.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: await mintForm("x.y.z"),
    });
    expect(rateLimited.status).toBe(429);

    fake.setHttpFault({ discoveryStatus: 503, error: "server_error" });
    const discovery = await fake.fetchFn(fake.discoveryUrl);
    expect(discovery.status).toBe(503);

    fake.setHttpFault({ delayMs: 25, jwksStatus: 500 });
    const started = Date.now();
    const jwks = await fake.fetchFn(fake.jwksUrl);
    expect(Date.now() - started).toBeGreaterThanOrEqual(20);
    expect(jwks.status).toBe(500);
  });

  it("rejects expired assertions at the time boundary and wrong client signatures", async () => {
    const clientKeys = await createPaciFakeEs256KeyPair({ reuse: false });
    let nowMs = 1_700_000_000_000;
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: clientKeys.publicKeyPem,
      now: () => nowMs,
    });

    const assertion = await fake.signClientAssertion({
      audience: fake.tokenEndpoint,
      clientPrivateKeyPem: clientKeys.privateKeyPem,
      ttlSeconds: 60,
    });
    nowMs += 61_000;
    const expired = await fake.fetchFn(fake.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: await mintForm(assertion),
    });
    expect(expired.status).toBe(401);

    const other = await createPaciFakeEs256KeyPair({ reuse: false });
    const spoofed = await fake.signClientAssertion({
      audience: fake.tokenEndpoint,
      clientPrivateKeyPem: other.privateKeyPem,
    });
    nowMs = 1_700_000_000_000;
    const badSig = await fake.fetchFn(fake.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: await mintForm(spoofed),
    });
    expect(badSig.status).toBe(401);
  });

  it("publishes JWKS and discovery via fetch dispatcher", async () => {
    const clientKeys = await createPaciFakeEs256KeyPair({ reuse: false });
    const serverKeys = await createPaciFakeEs256KeyPair({
      kid: "jwks-kid",
      reuse: false,
    });
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: clientKeys.publicKeyPem,
      serverKeys,
    });
    const discovery = await (await fake.fetchFn(fake.discoveryUrl)).json();
    expect(discovery).toEqual(fake.metadata);
    const jwks = (await (await fake.fetchFn(fake.jwksUrl)).json()) as {
      keys: Array<{ kid?: string }>;
    };
    expect(jwks.keys[0]?.kid).toBe("jwks-kid");

    // Public JWKS must verify against exported SPKI.
    const pem = await exportSPKI(serverKeys.publicKey);
    await expect(importSPKI(pem, PACI_ALG)).resolves.toBeTruthy();
  });

  it("grants subset scope and omits full credential set when scope omitted", async () => {
    const clientKeys = await createPaciFakeEs256KeyPair({ reuse: false });
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: clientKeys.publicKeyPem,
      serviceScopes: ["lbrain", "linkplatform"],
      audience: ["lbrain-api"],
      domain: "lbrain",
      now: () => 1_700_000_000_000,
    });

    const subsetAssertion = await fake.signClientAssertion({
      audience: fake.tokenEndpoint,
      clientPrivateKeyPem: clientKeys.privateKeyPem,
    });
    const subsetRes = await fake.fetchFn(fake.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: await mintForm(subsetAssertion, "lbrain"),
    });
    expect(subsetRes.status).toBe(200);
    const subsetToken = (await subsetRes.json()) as { access_token: string };
    const subsetPayload = JSON.parse(
      Buffer.from(subsetToken.access_token.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    const subsetClaims = subsetPayload[AUTH_CLAIMS_CLAIM_KEY] as {
      serviceScopes: string[];
    };
    expect(subsetClaims.serviceScopes).toEqual(["lbrain"]);

    const fullAssertion = await fake.signClientAssertion({
      audience: fake.tokenEndpoint,
      clientPrivateKeyPem: clientKeys.privateKeyPem,
    });
    const fullRes = await fake.fetchFn(fake.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: await mintForm(fullAssertion),
    });
    const fullToken = (await fullRes.json()) as { access_token: string };
    const fullPayload = JSON.parse(
      Buffer.from(fullToken.access_token.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    const fullClaims = fullPayload[AUTH_CLAIMS_CLAIM_KEY] as { serviceScopes: string[] };
    expect(fullClaims.serviceScopes).toEqual(["lbrain", "linkplatform"]);
  });
});

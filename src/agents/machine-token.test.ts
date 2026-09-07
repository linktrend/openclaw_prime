import { afterEach, describe, expect, it, vi } from "vitest";
import { createPaciFakeEs256KeyPair } from "../../test/helpers/paci-fake/keys.js";
import { createPaciFakeServer } from "../../test/helpers/paci-fake/server.js";
import { createMachineTokenClientAssertion } from "./machine-token-assertion.js";
import {
  buildMachineTokenBindingFingerprint,
  fingerprintMachineTokenKeyRef,
} from "./machine-token-fingerprint.js";
import {
  assertMachineTokenNetworkUrl,
  isMachineTokenLocalTestLoopbackHost,
} from "./machine-token-network.js";
import type { MachineTokenBinding } from "./machine-token-types.js";
import {
  assertMachineTokenIssuerUrl,
  buildMachineTokenDiscoveryUrl,
  clearMachineTokenCache,
  invalidateMachineTokenCache,
  resolveMachineTokenAccess,
} from "./machine-token.js";

const ISSUER = "https://paci.test";
const CLIENT_ID = "brain-client";

async function createBinding(
  overrides: Partial<MachineTokenBinding> = {},
): Promise<{ binding: MachineTokenBinding; publicKeyPem: string }> {
  const keys = await createPaciFakeEs256KeyPair({ reuse: false });
  return {
    publicKeyPem: keys.publicKeyPem,
    binding: {
      bindingId: "binding-brain",
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      // Omit scope → paci-fake grants the full credential serviceScopes set.
      clientAssertionKeyPem: keys.privateKeyPem,
      ...overrides,
    },
  };
}

describe("machine-token resolve + discovery", () => {
  afterEach(() => {
    clearMachineTokenCache();
  });

  it("builds discovery URL and rejects trailing-slash or path issuers", () => {
    expect(buildMachineTokenDiscoveryUrl(ISSUER)).toBe(
      `${ISSUER}/.well-known/oauth-authorization-server`,
    );
    expect(() => assertMachineTokenIssuerUrl(`${ISSUER}/`)).toThrow(/trailing slash/u);
    expect(() => assertMachineTokenIssuerUrl(`${ISSUER}/tenant`)).toThrow(/path/u);
    expect(() => buildMachineTokenDiscoveryUrl(`${ISSUER}/`)).toThrow(/trailing slash/u);
  });

  it("mints a Bearer token and reuses the process cache", async () => {
    const { binding, publicKeyPem } = await createBinding();
    const now = () => 1_700_000_000_000;
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: publicKeyPem,
      now,
    });

    const first = await resolveMachineTokenAccess({
      binding,
      fetchFn: fake.fetchFn,
      now,
    });
    const second = await resolveMachineTokenAccess({
      binding,
      fetchFn: fake.fetchFn,
      now,
    });

    expect(first.tokenType).toBe("Bearer");
    expect(first.bindingFingerprint).toBe(buildMachineTokenBindingFingerprint(binding));
    expect(first.accessToken).toBe(second.accessToken);
    expect(first.expiresAt).toBe(now() + 900_000);
    expect(fake.tokenRequestCount()).toBe(1);
    expect(fake.isAccessTokenActive(first.accessToken)).toBe(true);
  });

  it("early-renews when remaining TTL is below 20%", async () => {
    const { binding, publicKeyPem } = await createBinding();
    let nowMs = 1_700_000_000_000;
    const now = () => nowMs;
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: publicKeyPem,
      now,
    });
    const first = await resolveMachineTokenAccess({
      binding,
      fetchFn: fake.fetchFn,
      now,
    });
    // Remaining = 19% of 900s lifetime → must renew.
    nowMs = first.expiresAt - Math.floor(900_000 * 0.19);
    const renewed = await resolveMachineTokenAccess({
      binding,
      fetchFn: fake.fetchFn,
      now,
    });
    expect(renewed.accessToken).not.toBe(first.accessToken);
    expect(fake.tokenRequestCount()).toBe(2);
  });

  it("rejects assertion jti replay at the fake server", async () => {
    const { binding, publicKeyPem } = await createBinding();
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: publicKeyPem,
    });
    const assertion = await createMachineTokenClientAssertion({
      clientId: CLIENT_ID,
      tokenEndpoint: fake.tokenEndpoint,
      clientAssertionKeyPem: binding.clientAssertionKeyPem,
    });
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: assertion.assertion,
    });
    const first = await fake.fetchFn(fake.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    expect(first.status).toBe(200);
    const replay = await fake.fetchFn(fake.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    expect(replay.status).toBe(401);
    const replayJson = (await replay.json()) as { error_description?: string };
    expect(replayJson.error_description).toMatch(/jti replay/u);
  });

  it("coalesces concurrent resolveMachineTokenAccess into one token request", async () => {
    const { binding, publicKeyPem } = await createBinding();
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: publicKeyPem,
    });
    let releaseToken!: () => void;
    const tokenGate = new Promise<void>((resolve) => {
      releaseToken = resolve;
    });
    const gatedFetch: typeof fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      if (new URL(request.url).pathname === "/oauth/token") {
        await tokenGate;
      }
      return await fake.fetchFn(input, init);
    };

    const p1 = resolveMachineTokenAccess({ binding, fetchFn: gatedFetch });
    const p2 = resolveMachineTokenAccess({ binding, fetchFn: gatedFetch });
    // Allow both callers to register against the in-flight mint.
    await Promise.resolve();
    await Promise.resolve();
    releaseToken();
    const [a, b] = await Promise.all([p1, p2]);
    expect(a.accessToken).toBe(b.accessToken);
    expect(fake.tokenRequestCount()).toBe(1);
  });

  it("aborts mid-flight without abandoning the in-flight map", async () => {
    const { binding, publicKeyPem } = await createBinding();
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: publicKeyPem,
    });
    const controller = new AbortController();
    let sawToken = false;
    const gatedFetch: typeof fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      if (new URL(request.url).pathname === "/oauth/token") {
        sawToken = true;
        controller.abort();
        // Propagate abort like a real fetch would when signal fires mid-request.
        throw controller.signal.reason ?? new DOMException("aborted", "AbortError");
      }
      return await fake.fetchFn(input, init);
    };

    await expect(
      resolveMachineTokenAccess({
        binding,
        fetchFn: gatedFetch,
        signal: controller.signal,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      return (
        error instanceof Error && (error.name === "AbortError" || /abort/iu.test(error.message))
      );
    });
    expect(sawToken).toBe(true);

    // A later resolve must mint successfully (no abandoned lock).
    const recovered = await resolveMachineTokenAccess({
      binding,
      fetchFn: fake.fetchFn,
    });
    expect(recovered.tokenType).toBe("Bearer");
    expect(fake.tokenRequestCount()).toBe(1);
  });

  it("denies wrong metadata and missing private_key_jwt", async () => {
    const { binding, publicKeyPem } = await createBinding();
    const missingMethod = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: publicKeyPem,
      omitPrivateKeyJwt: true,
    });
    await expect(
      resolveMachineTokenAccess({ binding, fetchFn: missingMethod.fetchFn }),
    ).rejects.toThrow(/private_key_jwt|shared-secret/u);

    clearMachineTokenCache();
    const interactiveOnly = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: publicKeyPem,
      omitClientCredentials: true,
    });
    await expect(
      resolveMachineTokenAccess({ binding, fetchFn: interactiveOnly.fetchFn }),
    ).rejects.toThrow(/client_credentials|response_types_supported/u);
  });

  it("rejects token responses that include refresh_token", async () => {
    const { binding, publicKeyPem } = await createBinding();
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: publicKeyPem,
      includeRefreshToken: true,
    });
    await expect(resolveMachineTokenAccess({ binding, fetchFn: fake.fetchFn })).rejects.toThrow(
      /refresh_token/u,
    );
  });

  it("rejects non-frozen expires_in values", async () => {
    const { binding, publicKeyPem } = await createBinding();
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: publicKeyPem,
      expiresInSeconds: 901,
    });
    await expect(resolveMachineTokenAccess({ binding, fetchFn: fake.fetchFn })).rejects.toThrow(
      /expires_in must be exactly 900/u,
    );
  });

  it("invalidates cache by binding fingerprint so the next resolve remints", async () => {
    const { binding, publicKeyPem } = await createBinding();
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: publicKeyPem,
    });
    const first = await resolveMachineTokenAccess({ binding, fetchFn: fake.fetchFn });
    invalidateMachineTokenCache(binding);
    const second = await resolveMachineTokenAccess({ binding, fetchFn: fake.fetchFn });
    expect(second.accessToken).not.toBe(first.accessToken);
    expect(fake.tokenRequestCount()).toBe(2);

    invalidateMachineTokenCache(first.bindingFingerprint);
    const third = await resolveMachineTokenAccess({ binding, fetchFn: fake.fetchFn });
    expect(third.accessToken).not.toBe(second.accessToken);
    expect(fake.tokenRequestCount()).toBe(3);
  });

  it("does not put access tokens into Error.message on HTTP failure", async () => {
    const { binding, publicKeyPem } = await createBinding();
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: publicKeyPem,
    });
    fake.suspendClient();
    await expect(resolveMachineTokenAccess({ binding, fetchFn: fake.fetchFn })).rejects.toThrow(
      /HTTP 401/u,
    );
  });
});

describe("machine-token binding fingerprint isolation", () => {
  afterEach(() => {
    clearMachineTokenCache();
  });

  it("never reuses tokens across issuers that share the same bindingId label", async () => {
    const sharedLabel = "operator-shared-label";
    const keysA = await createPaciFakeEs256KeyPair({ reuse: false });
    const keysB = await createPaciFakeEs256KeyPair({ reuse: false });
    const issuerA = "https://paci-a.test";
    const issuerB = "https://paci-b.test";
    const bindingA: MachineTokenBinding = {
      bindingId: sharedLabel,
      issuerUrl: issuerA,
      clientId: "client-a",
      clientAssertionKeyPem: keysA.privateKeyPem,
      service: "brain",
      environment: "test",
    };
    const bindingB: MachineTokenBinding = {
      bindingId: sharedLabel,
      issuerUrl: issuerB,
      clientId: "client-b",
      clientAssertionKeyPem: keysB.privateKeyPem,
      service: "skills",
      environment: "test",
    };
    expect(buildMachineTokenBindingFingerprint(bindingA)).not.toBe(
      buildMachineTokenBindingFingerprint(bindingB),
    );

    const fakeA = await createPaciFakeServer({
      issuerUrl: issuerA,
      clientId: "client-a",
      clientPublicKeyPem: keysA.publicKeyPem,
    });
    const fakeB = await createPaciFakeServer({
      issuerUrl: issuerB,
      clientId: "client-b",
      clientPublicKeyPem: keysB.publicKeyPem,
    });
    const dispatch: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.origin === new URL(issuerA).origin) {
        return await fakeA.fetchFn(input, init);
      }
      if (url.origin === new URL(issuerB).origin) {
        return await fakeB.fetchFn(input, init);
      }
      return new Response("not found", { status: 404 });
    };

    const tokenA = await resolveMachineTokenAccess({ binding: bindingA, fetchFn: dispatch });
    const tokenB = await resolveMachineTokenAccess({ binding: bindingB, fetchFn: dispatch });
    expect(tokenA.accessToken).not.toBe(tokenB.accessToken);
    expect(tokenA.bindingFingerprint).not.toBe(tokenB.bindingFingerprint);
    expect(fakeA.tokenRequestCount()).toBe(1);
    expect(fakeB.tokenRequestCount()).toBe(1);

    // Cache hits stay isolated per fingerprint.
    const againA = await resolveMachineTokenAccess({ binding: bindingA, fetchFn: dispatch });
    const againB = await resolveMachineTokenAccess({ binding: bindingB, fetchFn: dispatch });
    expect(againA.accessToken).toBe(tokenA.accessToken);
    expect(againB.accessToken).toBe(tokenB.accessToken);
    expect(fakeA.tokenRequestCount()).toBe(1);
    expect(fakeB.tokenRequestCount()).toBe(1);
  });

  it("invalidates only the exact prior fingerprint after keyRef/scope rotation", async () => {
    const keys = await createPaciFakeEs256KeyPair({ reuse: false });
    const keyRefA = fingerprintMachineTokenKeyRef({
      source: "env",
      provider: "default",
      id: "KEY_A",
    });
    const keyRefB = fingerprintMachineTokenKeyRef({
      source: "env",
      provider: "default",
      id: "KEY_B",
    });
    const base: MachineTokenBinding = {
      bindingId: "binding-rotate",
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientAssertionKeyPem: keys.privateKeyPem,
      keyRefFingerprint: keyRefA,
      scope: "lbrain",
    };
    const rotatedKey: MachineTokenBinding = { ...base, keyRefFingerprint: keyRefB };
    const rotatedScope: MachineTokenBinding = { ...base, scope: "linkplatform" };
    expect(buildMachineTokenBindingFingerprint(base)).not.toBe(
      buildMachineTokenBindingFingerprint(rotatedKey),
    );
    expect(buildMachineTokenBindingFingerprint(base)).not.toBe(
      buildMachineTokenBindingFingerprint(rotatedScope),
    );

    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: keys.publicKeyPem,
      serviceScopes: ["lbrain", "linkplatform"],
      domain: "lbrain",
    });
    const first = await resolveMachineTokenAccess({ binding: base, fetchFn: fake.fetchFn });
    invalidateMachineTokenCache(base);
    const afterKey = await resolveMachineTokenAccess({
      binding: rotatedKey,
      fetchFn: fake.fetchFn,
    });
    expect(afterKey.accessToken).not.toBe(first.accessToken);
    // Prior fingerprint stays gone; new fingerprint is independent.
    const cachedOld = await resolveMachineTokenAccess({ binding: base, fetchFn: fake.fetchFn });
    expect(cachedOld.accessToken).not.toBe(afterKey.accessToken);
    expect(fake.tokenRequestCount()).toBe(3);

    // Scope rotation also changes fingerprint independently of keyRef.
    invalidateMachineTokenCache(rotatedKey);
    const afterScope = await resolveMachineTokenAccess({
      binding: rotatedScope,
      fetchFn: fake.fetchFn,
    });
    expect(afterScope.accessToken).not.toBe(afterKey.accessToken);
    expect(afterScope.bindingFingerprint).not.toBe(afterKey.bindingFingerprint);
  });
});

describe("machine-token network policy", () => {
  // Soft/incomplete metadata rejection cases live in machine-token-discovery.test.ts
  // (exact Phase-1 RFC 8414 fixtures). Keep only network policy here.

  it("requires HTTPS except explicit local-test loopback HTTP", () => {
    expect(isMachineTokenLocalTestLoopbackHost("127.0.0.1")).toBe(true);
    expect(isMachineTokenLocalTestLoopbackHost("localhost")).toBe(true);
    expect(isMachineTokenLocalTestLoopbackHost("::1")).toBe(true);
    expect(isMachineTokenLocalTestLoopbackHost("paci.test")).toBe(false);

    expect(() =>
      assertMachineTokenNetworkUrl({ url: "http://paci.test", label: "issuer URL" }),
    ).toThrow(/HTTPS/u);
    expect(() =>
      assertMachineTokenNetworkUrl({
        url: "http://127.0.0.1:9",
        label: "issuer URL",
        localTest: true,
      }),
    ).not.toThrow();
    expect(() =>
      assertMachineTokenNetworkUrl({
        url: "http://127.0.0.1:9",
        label: "issuer URL",
      }),
    ).toThrow(/HTTPS|loopback/u);
    expect(() =>
      assertMachineTokenNetworkUrl({
        url: "https://127.0.0.1",
        label: "issuer URL",
      }),
    ).toThrow(/loopback/u);
  });
});

describe("machine-token single-flight race harness", () => {
  afterEach(() => {
    clearMachineTokenCache();
    vi.restoreAllMocks();
  });

  it("keeps forceRefresh from serving a stale cached token", async () => {
    const { binding, publicKeyPem } = await createBinding();
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: publicKeyPem,
    });
    const first = await resolveMachineTokenAccess({ binding, fetchFn: fake.fetchFn });
    const forced = await resolveMachineTokenAccess({
      binding,
      fetchFn: fake.fetchFn,
      forceRefresh: true,
    });
    expect(forced.accessToken).not.toBe(first.accessToken);
    expect(fake.tokenRequestCount()).toBe(2);
  });
});

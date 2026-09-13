import { describe, expect, it } from "vitest";
import {
  PLATFORM_COMMIT,
  PLATFORM_TREE,
  PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION,
  PLATFORM_AUTH_CLAIMS_SCHEMA_VERSION,
  validatePlatformTrustFacts,
  validateProviderClaim,
  type ExpectedProviderClaim,
  type ProviderClaim,
} from "./src/claims.js";

const expected: ExpectedProviderClaim = {
  providerCandidate: { commit: PLATFORM_COMMIT, tree: PLATFORM_TREE },
  actorId: "actor-1",
  bindingId: "binding-1",
  orgId: "org-1",
  audience: "linkplatform",
  capability: "publish",
  now: 1_000,
};

const claim: ProviderClaim = {
  providerCandidate: expected.providerCandidate,
  actorId: expected.actorId,
  bindingId: expected.bindingId,
  orgId: expected.orgId,
  audience: expected.audience,
  capabilities: ["publish"],
  expiresAt: 2_000,
  status: "available",
};

describe("validateProviderClaim", () => {
  it("accepts a valid claim", () => {
    const result = validateProviderClaim(claim, expected);
    expect(result).toEqual({ valid: true, claim });
    if (result.valid) {
      expect(result.claim).not.toBe(claim);
      expect(result.claim.providerCandidate).not.toBe(claim.providerCandidate);
      expect(result.claim.capabilities).not.toBe(claim.capabilities);
    }
  });

  it.each([
    ["commit", { commit: "other", tree: PLATFORM_TREE }],
    ["tree", { commit: PLATFORM_COMMIT, tree: "other" }],
  ] as const)("rejects caller-supplied provider pin with wrong %s", (_part, providerCandidate) => {
    expect(validateProviderClaim(claim, { ...expected, providerCandidate }).valid).toBe(false);
  });

  for (const [name, change] of [
    ["missing provider candidate", (c: Record<string, unknown>) => delete c.providerCandidate],
    [
      "wrong commit",
      (c: Record<string, unknown>) =>
        ((c.providerCandidate as Record<string, unknown>).commit = "other"),
    ],
    [
      "wrong tree",
      (c: Record<string, unknown>) =>
        ((c.providerCandidate as Record<string, unknown>).tree = "other"),
    ],
    [
      "extra provider candidate key",
      (c: Record<string, unknown>) =>
        ((c.providerCandidate as Record<string, unknown>).extra = true),
    ],
    ["empty actor", (c: Record<string, unknown>) => (c.actorId = "")],
    ["overlong binding", (c: Record<string, unknown>) => (c.bindingId = "x".repeat(257))],
    ["non-string capability", (c: Record<string, unknown>) => (c.capabilities = [1])],
    ["wrong actor", (c: Record<string, unknown>) => (c.actorId = "other")],
    ["wrong binding", (c: Record<string, unknown>) => (c.bindingId = "other")],
    ["wrong org", (c: Record<string, unknown>) => (c.orgId = "other")],
    ["wrong audience", (c: Record<string, unknown>) => (c.audience = "other")],
    ["missing capability", (c: Record<string, unknown>) => (c.capabilities = [])],
    ["expired claim", (c: Record<string, unknown>) => (c.expiresAt = expected.now)],
    ["non-finite expiry", (c: Record<string, unknown>) => (c.expiresAt = Number.POSITIVE_INFINITY)],
    ["revoked binding", (c: Record<string, unknown>) => (c.bindingRevoked = true)],
    ["unauthorized binding", (c: Record<string, unknown>) => (c.status = "unauthorized")],
    ["degraded status", (c: Record<string, unknown>) => (c.status = "degraded")],
    ["offline status", (c: Record<string, unknown>) => (c.status = "offline")],
    ["forbidden status", (c: Record<string, unknown>) => (c.status = "forbidden")],
    ["stale status", (c: Record<string, unknown>) => (c.status = "stale")],
    ["model actor id", (c: Record<string, unknown>) => (c.modelActorId = "model")],
    ["prompt", (c: Record<string, unknown>) => (c.prompt = "prompt")],
    ["reasoning", (c: Record<string, unknown>) => (c.reasoning = "reasoning")],
    ["transcript", (c: Record<string, unknown>) => (c.transcript = "transcript")],
    [
      "private payload",
      (c: Record<string, unknown>) => (c.privatePayload = "fixture-private-payload"),
    ],
    ["raw tool", (c: Record<string, unknown>) => (c.raw_tool = "tool")],
    ["unknown field", (c: Record<string, unknown>) => (c.unknown = true)],
  ] as const) {
    it(`rejects ${name}`, () => {
      const copy = structuredClone(claim) as Record<string, unknown>;
      change(copy);
      expect(validateProviderClaim(copy, expected).valid).toBe(false);
    });
  }
});

describe("validatePlatformTrustFacts", () => {
  const trustExpected = {
    actorId: "actor-1",
    orgId: "org-1",
    runtimeBindingId: "binding-1",
    issuer: "https://issuer.example.test",
    audience: "openclaw-prime",
    capability: "provider.read",
    serviceScope: "provider.read",
    revocationObservedAt: "2026-08-13T11:59:00.000Z",
    now: "2026-08-13T12:00:00.000Z",
  } as const;
  const facts = {
    providerCandidate: { commit: PLATFORM_COMMIT, tree: PLATFORM_TREE },
    claimContractVersion: PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION,
    schemaVersion: PLATFORM_AUTH_CLAIMS_SCHEMA_VERSION,
    actorId: "actor-1",
    orgId: "org-1",
    runtimeBindingId: "binding-1",
    credentialId: "credential-ref-1",
    issuer: "https://issuer.example.test",
    audience: "openclaw-prime",
    serviceScopes: ["provider.read"],
    capabilities: ["provider.read"],
    issuedAt: "2026-08-13T00:00:00.000Z",
    expiresAt: "2026-08-14T00:00:00.000Z",
    revocationStatus: "active",
  } as const;
  it("accepts verified identity facts without accepting secret material", () => {
    expect(
      validatePlatformTrustFacts(facts, {
        ...trustExpected,
      }),
    ).toMatchObject({ valid: true });
  });
  it.each([
    ["wrong actor", { actorId: "other" }],
    ["wrong org", { orgId: "other" }],
    ["wrong binding", { runtimeBindingId: "other" }],
    ["wrong issuer", { issuer: "https://other.example.test" }],
    ["wrong audience", { audience: "other" }],
    ["wrong scope", { serviceScopes: ["other"] }],
    ["wrong capability", { capabilities: ["other"] }],
    ["revoked", { revocationStatus: "revoked" }],
    ["expired", { expiresAt: "2026-08-13T00:00:00.000Z" }],
    ["malformed issued date", { issuedAt: "2026-02-30T00:00:00.000Z" }],
    ["malformed expiry date", { expiresAt: "2026-02-30T00:00:00.000Z" }],
    ["newline in trust reference", { credentialId: "credential-ref-1\n" }],
    ["newline in trust timestamp", { expiresAt: "2026-08-14T00:00:00.000Z\n" }],
    ["private payload field", { privatePayload: "fixture-private-payload" }],
  ] as const)("fails closed for %s", (_name, change) => {
    expect(
      validatePlatformTrustFacts(
        { ...facts, ...change },
        {
          ...trustExpected,
        },
      ).valid,
    ).toBe(false);
  });
});

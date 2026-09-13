import { describe, expect, it } from "vitest";
import {
  authorizePlatformCapability,
  evaluatePlatformEligibilityGate,
  evaluateProfileActivationGate,
  evaluateSkillsQualificationGate,
  PLATFORM_DECLARED_CAPABILITIES,
  PLATFORM_IDENTITY,
} from "./src/capability-gates.js";
import {
  PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION,
  PLATFORM_AUTH_CLAIMS_SCHEMA_VERSION,
  PLATFORM_COMMIT,
  PLATFORM_TREE,
} from "./src/claims.js";

const now = "2026-09-12T15:00:00.000Z";
const facts = {
  actorId: "actor-1",
  audience: "linkplatform",
  scope: "lplatform",
  resource: "platform:identity",
  action: "platform.consume_facts",
  tenantId: "org-1",
  agentId: "agent-main",
};
const trustFacts = {
  providerCandidate: { commit: PLATFORM_COMMIT, tree: PLATFORM_TREE },
  claimContractVersion: PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION,
  schemaVersion: PLATFORM_AUTH_CLAIMS_SCHEMA_VERSION,
  actorId: facts.actorId,
  orgId: "org-1",
  runtimeBindingId: "bind-1",
  credentialId: "cred-1",
  issuer: "https://issuer.example",
  audience: facts.audience,
  serviceScopes: [facts.scope],
  capabilities: [facts.action],
  issuedAt: "2026-09-12T14:59:00.000Z",
  expiresAt: "2026-09-12T16:00:00.000Z",
  revocationStatus: "active" as const,
};
const trustExpected = {
  actorId: facts.actorId,
  orgId: "org-1",
  runtimeBindingId: "bind-1",
  issuer: "https://issuer.example",
  audience: facts.audience,
  capability: facts.action,
  serviceScope: facts.scope,
  revocationObservedAt: now,
  now,
};
const profileActivation = {
  profileId: "lisa",
  activationState: "active" as const,
  exposedCapabilities: ["platform.consume_facts"],
  executionAuthority: "none" as const,
};

describe("PKT-03 platform three-gate consumer", () => {
  it("pins exact Platform identity", () => {
    expect(PLATFORM_IDENTITY).toEqual({ commit: PLATFORM_COMMIT, tree: PLATFORM_TREE });
    expect(PLATFORM_DECLARED_CAPABILITIES).toContain("platform.consume_facts");
  });

  it("authorizes only when eligibility and profile activation both allow", () => {
    const result = authorizePlatformCapability({
      facts,
      trustFacts,
      trustExpected,
      skillsQualification: { outcome: "not_applicable" },
      profileActivation,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.gates.map((gate) => gate.gate)).toEqual([
        "platform_eligibility",
        "skills_qualification",
        "profile_activation",
      ]);
      expect(result.gates[1]?.outcome).toBe("not_applicable");
    }
  });

  it("keeps gates independent: inactive profile denies despite eligibility", () => {
    const result = authorizePlatformCapability({
      facts,
      trustFacts,
      trustExpected,
      skillsQualification: { outcome: "not_applicable" },
      profileActivation: { ...profileActivation, activationState: "inactive" },
    });
    expect(result).toMatchObject({ ok: false, reason: "profile_inactive" });
    expect(evaluatePlatformEligibilityGate({ facts, trustFacts, trustExpected }).outcome).toBe(
      "allow",
    );
  });

  it("keeps gates independent: eligibility deny despite active profile", () => {
    const result = authorizePlatformCapability({
      facts,
      trustFacts: { ...trustFacts, audience: "other" },
      trustExpected,
      skillsQualification: { outcome: "not_applicable" },
      profileActivation,
    });
    expect(result.ok).toBe(false);
    expect(evaluateProfileActivationGate(profileActivation, facts.action).outcome).toBe("allow");
  });

  it("does not treat Skills qualification as Platform eligibility", () => {
    expect(
      evaluateSkillsQualificationGate({ lifecycle: "qualified", selectability: "selectable" }),
    ).toMatchObject({
      outcome: "deny",
      reason: "platform_does_not_consume_skills_qualification",
    });
  });

  it.each([
    "roleGrant",
    "brainRule",
    "visibleSkill",
    "librariesPackage",
    "autoworkReceipt",
  ] as const)("rejects %s elevation", (key) => {
    expect(
      authorizePlatformCapability({
        facts,
        trustFacts,
        trustExpected,
        skillsQualification: { outcome: "not_applicable" },
        profileActivation,
        [key]: true,
      }).reason,
    ).toBe("elevation_claim_rejected");
  });

  it("denies cross-agent, cross-tenant, undeclared, and execution-authority claims", () => {
    expect(
      authorizePlatformCapability({
        facts,
        trustFacts,
        trustExpected,
        skillsQualification: { outcome: "not_applicable" },
        profileActivation,
        expectedAgentId: "other-agent",
      }).reason,
    ).toBe("cross_agent_denied");
    expect(
      authorizePlatformCapability({
        facts,
        trustFacts,
        trustExpected,
        skillsQualification: { outcome: "not_applicable" },
        profileActivation,
        expectedTenantId: "other-org",
      }).reason,
    ).toBe("cross_tenant_denied");
    expect(
      authorizePlatformCapability({
        facts: { ...facts, action: "platform.admin" },
        trustFacts,
        trustExpected,
        skillsQualification: { outcome: "not_applicable" },
        profileActivation,
      }).reason,
    ).toBe("undeclared_capability");
    expect(
      evaluateProfileActivationGate(
        { ...profileActivation, executionAuthority: "program" },
        facts.action,
      ).reason,
    ).toBe("provider_execution_authority_forbidden");
  });
});

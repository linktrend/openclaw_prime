import { describe, expect, it } from "vitest";
import {
  authorizeLibrariesCapability,
  LIBRARIES_DECLARED_CAPABILITIES,
  LIBRARIES_IDENTITY,
} from "./src/capability-gates.js";
import { LIBRARIES_COMMIT, LIBRARIES_TREE } from "./src/revision2-pins.js";

const facts = {
  actorId: "actor-1",
  audience: "llibraries",
  scope: "llibraries",
  resource: "libraries:catalogue",
  action: "libraries.no_current_requirement",
  tenantId: "org-1",
  agentId: "agent-main",
};
const platformEligibility = { outcome: "allow" as const, facts };
const profileActivation = {
  profileId: "lisa",
  activationState: "active" as const,
  exposedCapabilities: [...LIBRARIES_DECLARED_CAPABILITIES],
  executionAuthority: "none" as const,
};

describe("PKT-03 libraries three-gate consumer", () => {
  it("pins exact Libraries identity", () => {
    expect(LIBRARIES_IDENTITY).toEqual({ commit: LIBRARIES_COMMIT, tree: LIBRARIES_TREE });
  });

  it("concludes no current Lisa use after independent gates", () => {
    const result = authorizeLibrariesCapability({
      facts,
      platformEligibility,
      skillsQualification: { outcome: "not_applicable" },
      profileActivation,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.capability).toBe("libraries.no_current_requirement");
    }
  });

  it("never materializes a Lisa asset even when all gates would otherwise allow", () => {
    const useFacts = { ...facts, action: "libraries.lisa_asset" };
    expect(
      authorizeLibrariesCapability({
        facts: useFacts,
        platformEligibility: { outcome: "allow", facts: useFacts },
        skillsQualification: { outcome: "not_applicable" },
        profileActivation: {
          ...profileActivation,
          exposedCapabilities: ["libraries.lisa_asset"],
        },
      }).reason,
    ).toBe("no_current_libraries_use");
  });

  it("rejects a Libraries package as an elevation claim", () => {
    expect(
      authorizeLibrariesCapability({
        facts,
        platformEligibility,
        skillsQualification: { outcome: "not_applicable" },
        profileActivation,
        librariesPackage: "pkg-1",
      }).reason,
    ).toBe("elevation_claim_rejected");
  });

  it("denies cross-tenant identity verification", () => {
    const verifyFacts = { ...facts, action: "libraries.identity.verify" };
    expect(
      authorizeLibrariesCapability({
        facts: verifyFacts,
        platformEligibility: { outcome: "allow", facts: verifyFacts },
        skillsQualification: { outcome: "not_applicable" },
        profileActivation,
        expectedTenantId: "other-org",
      }).reason,
    ).toBe("cross_tenant_denied");
  });
});

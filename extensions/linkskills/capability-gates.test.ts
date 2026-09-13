import { describe, expect, it } from "vitest";
import {
  authorizeSkillsCapability,
  evaluatePlatformEligibilityGate,
  evaluateProfileActivationGate,
  evaluateSkillsQualificationGate,
  SKILLS_IDENTITY,
} from "./src/capability-gates.js";
import { SKILLS_COMMIT, SKILLS_TREE } from "./src/exact-release.js";

const facts = {
  actorId: "actor-1",
  audience: "lskills-api",
  scope: "lskills",
  resource: "skill.workspace.mail",
  action: "skills_release_content_get",
  tenantId: "org-1",
  agentId: "agent-main",
};
const platformEligibility = { outcome: "allow" as const, facts };
const skillsQualification = {
  providerCandidate: { commit: SKILLS_COMMIT, tree: SKILLS_TREE },
  skillId: facts.resource,
  version: "1.2.3",
  lifecycle: "qualified",
  selectability: "selectable",
};
const profileActivation = {
  profileId: "lisa",
  activationState: "active" as const,
  exposedCapabilities: [facts.action],
  executionAuthority: "none" as const,
};

describe("PKT-03 skills three-gate consumer", () => {
  it("pins exact Skills identity", () => {
    expect(SKILLS_IDENTITY).toEqual({ commit: SKILLS_COMMIT, tree: SKILLS_TREE });
  });

  it("authorizes exact retrieval only when all three independent gates allow", () => {
    const result = authorizeSkillsCapability({
      facts,
      platformEligibility,
      skillsQualification,
      profileActivation,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.gates.every((gate) => gate.outcome === "allow")).toBe(true);
    }
  });

  it("rejects discovery-only qualification even when the profile exposes the tool", () => {
    expect(
      authorizeSkillsCapability({
        facts,
        platformEligibility,
        skillsQualification: { ...skillsQualification, discoveryOnly: true },
        profileActivation,
      }).reason,
    ).toBe("discovery_does_not_grant");
    expect(evaluateProfileActivationGate(profileActivation, facts.action).outcome).toBe("allow");
  });

  it("rejects unqualified or non-selectable releases without consulting profile activation", () => {
    expect(
      evaluateSkillsQualificationGate({ ...skillsQualification, lifecycle: "draft" }, facts).reason,
    ).toBe("not_qualified");
    expect(
      evaluateSkillsQualificationGate(
        { ...skillsQualification, selectability: "non_selectable" },
        facts,
      ).reason,
    ).toBe("not_selectable");
    expect(evaluatePlatformEligibilityGate(platformEligibility, facts).outcome).toBe("allow");
  });

  it("does not let eligibility or qualification activate an inactive profile", () => {
    expect(
      authorizeSkillsCapability({
        facts,
        platformEligibility,
        skillsQualification,
        profileActivation: { ...profileActivation, activationState: "inactive" },
      }).reason,
    ).toBe("profile_inactive");
  });

  it.each(["roleGrant", "brainRule", "visibleSkill"] as const)("rejects %s elevation", (key) => {
    expect(
      authorizeSkillsCapability({
        facts,
        platformEligibility,
        skillsQualification,
        profileActivation,
        [key]: true,
      }).reason,
    ).toBe("elevation_claim_rejected");
  });

  it("denies cross-tenant, latest aliases, pin mismatches, and undeclared local-execution names", () => {
    expect(
      authorizeSkillsCapability({
        facts,
        platformEligibility,
        skillsQualification,
        profileActivation,
        expectedTenantId: "other-org",
      }).reason,
    ).toBe("cross_tenant_denied");
    expect(
      evaluateSkillsQualificationGate({ ...skillsQualification, version: "latest" }, facts).reason,
    ).toBe("latest_alias");
    expect(
      evaluateSkillsQualificationGate(
        { ...skillsQualification, providerCandidate: { commit: "other", tree: SKILLS_TREE } },
        facts,
      ).reason,
    ).toBe("skills_pin_mismatch");
    expect(
      authorizeSkillsCapability({
        facts: { ...facts, action: "skills_run_start" },
        platformEligibility,
        skillsQualification,
        profileActivation,
      }).reason,
    ).toBe("undeclared_capability");
  });
});

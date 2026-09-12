import { describe, expect, it } from "vitest";
import {
  authorizeBrainCapability,
  BRAIN_DECLARED_CAPABILITIES,
  BRAIN_IDENTITY,
  evaluateProfileActivationGate,
} from "./src/capability-gates.js";
import { LINKBRAIN_V2_COMMIT, LINKBRAIN_V2_TREE } from "./src/v2-pins.js";

const facts = {
  actorId: "actor-1",
  audience: "lbrain",
  scope: "lbrain",
  resource: "brain:knowledge",
  action: "v2.knowledge.search",
  tenantId: "org-1",
  agentId: "agent-main",
};
const writeFacts = { ...facts, action: "v2.handoff.create", resource: "brain:coordination" };
const platformEligibility = { outcome: "allow" as const, facts };
const profileActivation = {
  profileId: "lisa",
  activationState: "active" as const,
  exposedCapabilities: ["v2.knowledge.search", "v2.handoff.create"],
  executionAuthority: "none" as const,
};

describe("PKT-03 brain three-gate consumer", () => {
  it("pins exact Brain identity and declared operations only", () => {
    expect(BRAIN_IDENTITY).toEqual({ commit: LINKBRAIN_V2_COMMIT, tree: LINKBRAIN_V2_TREE });
    expect(BRAIN_DECLARED_CAPABILITIES).toContain("v2.knowledge.search");
    expect(BRAIN_DECLARED_CAPABILITIES).not.toContain("brain.admin");
  });

  it("exposes read and candidate coordination write only after independent gates", () => {
    expect(
      authorizeBrainCapability({
        facts,
        platformEligibility,
        skillsQualification: { outcome: "not_applicable" },
        profileActivation,
      }).ok,
    ).toBe(true);
    expect(
      authorizeBrainCapability({
        facts: writeFacts,
        platformEligibility: { outcome: "allow", facts: writeFacts },
        skillsQualification: { outcome: "not_applicable" },
        profileActivation,
      }).ok,
    ).toBe(true);
  });

  it("does not let a Brain rule or visible skill elevate authorization", () => {
    expect(
      authorizeBrainCapability({
        facts,
        platformEligibility,
        skillsQualification: { outcome: "not_applicable" },
        profileActivation,
        brainRule: "always-allow",
      }).reason,
    ).toBe("elevation_claim_rejected");
    expect(
      authorizeBrainCapability({
        facts,
        platformEligibility,
        skillsQualification: { outcome: "not_applicable" },
        profileActivation,
        visibleSkill: "skill.workspace.mail",
      }).reason,
    ).toBe("elevation_claim_rejected");
  });

  it("denies undeclared operations, inactive profiles, and cross-agent reads", () => {
    expect(
      authorizeBrainCapability({
        facts: { ...facts, action: "v2.admin.wipe" },
        platformEligibility,
        skillsQualification: { outcome: "not_applicable" },
        profileActivation,
      }).reason,
    ).toBe("undeclared_capability");
    expect(
      authorizeBrainCapability({
        facts,
        platformEligibility,
        skillsQualification: { outcome: "not_applicable" },
        profileActivation: { ...profileActivation, activationState: "inactive" },
      }).reason,
    ).toBe("profile_inactive");
    expect(
      authorizeBrainCapability({
        facts,
        platformEligibility,
        skillsQualification: { outcome: "not_applicable" },
        profileActivation,
        expectedAgentId: "other",
      }).reason,
    ).toBe("cross_agent_denied");
    expect(
      evaluateProfileActivationGate(
        { ...profileActivation, exposedCapabilities: ["v2.knowledge.search"] },
        "v2.handoff.create",
      ).reason,
    ).toBe("capability_not_exposed");
  });
});

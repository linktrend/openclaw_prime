import { describe, expect, it } from "vitest";
import {
  authorizeAutoworkCapability,
  AUTOWORK_DECLARED_CAPABILITIES,
  AUTOWORK_IDENTITY,
} from "./src/capability-gates.js";
import { AUTOWORK_COMMIT, AUTOWORK_TREE } from "./src/contract-pins.js";

const facts = {
  actorId: "actor-1",
  audience: "autowork",
  scope: "lautowork",
  resource: "automation.digest",
  action: "autowork.request",
  tenantId: "org-1",
  agentId: "agent-main",
};
const platformEligibility = { outcome: "allow" as const, facts };
const assignment = {
  assigned: true,
  automationId: facts.resource,
  assigneeActorId: facts.actorId,
  operationKind: "notification_delivery",
};
const profileActivation = {
  profileId: "lisa",
  activationState: "active" as const,
  exposedCapabilities: [...AUTOWORK_DECLARED_CAPABILITIES],
  executionAuthority: "none" as const,
};

describe("PKT-03 autowork three-gate consumer", () => {
  it("pins exact Autowork identity", () => {
    expect(AUTOWORK_IDENTITY).toEqual({ commit: AUTOWORK_COMMIT, tree: AUTOWORK_TREE });
  });

  it("allows assigned-only request, status, and receipt surfaces", () => {
    for (const action of AUTOWORK_DECLARED_CAPABILITIES) {
      const requestFacts = { ...facts, action };
      expect(
        authorizeAutoworkCapability({
          facts: requestFacts,
          platformEligibility: { outcome: "allow", facts: requestFacts },
          skillsQualification: { outcome: "not_applicable" },
          profileActivation,
          assignment,
        }).ok,
      ).toBe(true);
    }
  });

  it("denies unassigned automations even with eligibility and an active profile", () => {
    expect(
      authorizeAutoworkCapability({
        facts,
        platformEligibility,
        skillsQualification: { outcome: "not_applicable" },
        profileActivation,
        assignment: {
          assigned: false,
          automationId: facts.resource,
          assigneeActorId: facts.actorId,
        },
      }).reason,
    ).toBe("unassigned_autowork_denied");
  });

  it("does not let an Autowork receipt grant permission", () => {
    expect(
      authorizeAutoworkCapability({
        facts,
        platformEligibility,
        skillsQualification: { outcome: "not_applicable" },
        profileActivation,
        assignment,
        autoworkReceipt: "receipt-1",
      }).reason,
    ).toBe("elevation_claim_rejected");
  });

  it("denies cross-agent assignment and undeclared operations", () => {
    expect(
      authorizeAutoworkCapability({
        facts,
        platformEligibility,
        skillsQualification: { outcome: "not_applicable" },
        profileActivation,
        assignment,
        expectedAgentId: "other-agent",
      }).reason,
    ).toBe("cross_agent_denied");
    expect(
      authorizeAutoworkCapability({
        facts: { ...facts, action: "autowork.execute_program" },
        platformEligibility,
        skillsQualification: { outcome: "not_applicable" },
        profileActivation,
        assignment,
      }).reason,
    ).toBe("undeclared_capability");
  });
});

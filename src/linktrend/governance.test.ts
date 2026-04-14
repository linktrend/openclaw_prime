import { describe, expect, it, vi } from "vitest";
import { emitAgentEvent } from "../infra/agent-events.js";
import { resolveLinktrendGovernance } from "./governance.js";

vi.mock("../infra/agent-events.js", () => ({
  emitAgentEvent: vi.fn(),
}));

describe("resolveLinktrendGovernance", () => {
  it("throws when bootstrap is denied", () => {
    expect(() =>
      resolveLinktrendGovernance({
        cfg: {},
        governance: {
          bootstrap: { authorizationState: "denied", denialReasonCategory: "revoked" },
        },
        ctx: { runId: "run-1", sessionKey: "agent:main:default" },
      }),
    ).toThrow(/bootstrap denied/);
    expect(emitAgentEvent).toHaveBeenCalled();
  });

  it("merges mission and instructions into extra system prompt", () => {
    const out = resolveLinktrendGovernance({
      cfg: {},
      governance: {
        bootstrap: { authorizationState: "granted", traceCorrelationId: "t1" },
        mission: { missionId: "m1", summaryText: "Do the thing" },
        runtimeInstructions: { text: "Use the approved method.", skillVersionRef: "sk@2" },
      },
      existingExtraSystemPrompt: "Existing",
      ctx: { runId: "run-2" },
    });
    expect(out.extraSystemPrompt).toContain("Existing");
    expect(out.extraSystemPrompt).toContain("Mission id: m1");
    expect(out.extraSystemPrompt).toContain("Do the thing");
    expect(out.extraSystemPrompt).toContain("Use the approved method.");
  });

  it("returns toolsAllow from approved tool names", () => {
    const out = resolveLinktrendGovernance({
      cfg: {},
      governance: {
        bootstrap: { authorizationState: "granted" },
        approvedTools: { toolNames: ["read", " exec ", "read"] },
      },
      ctx: { runId: "run-3" },
    });
    expect(out.toolsAllow).toEqual(["read", "exec"]);
  });

  it("enforces requireIngressGovernancePayload when enabled", () => {
    expect(() =>
      resolveLinktrendGovernance({
        cfg: { linktrendGovernance: { enabled: true, requireIngressGovernancePayload: true } },
        governance: undefined,
        ctx: { runId: "run-4" },
      }),
    ).toThrow(/governance payload is required/);
  });
});

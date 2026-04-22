import { describe, expect, it } from "vitest";
import { resolveLinktrendGovernance } from "../../../linktrend/governance.js";
import { normalizeLinktrendGovernanceInbound } from "../../../linktrend/normalize-governance-inbound.js";
import { validateAgentParams } from "../index.js";

describe("Linktrend governance schema + normalization", () => {
  it("validateAgentParams accepts monorepo-shaped granted payload", () => {
    const payload = {
      message: "ping",
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      sessionKey: "agent:main:main",
      linktrendGovernance: {
        bootstrap: {
          traceCorrelationId: "trace-1",
          authorizationState: "granted",
        },
        mission: {
          id: "mission-uuid",
          title: "Test mission",
        },
        runtimeInstructions: {
          text: "Short governance summary.",
          segments: [{ label: "Section A", text: "Do X then Y." }],
        },
        approvedTools: { toolNames: ["read", "exec"] },
        skillDeclaredTools: { toolNames: ["read", "exec", "admin"] },
        skillName: "demo-skill",
        skillVersion: "1.0.0",
        skillId: "skill-uuid",
      },
    };
    expect(validateAgentParams(payload)).toBe(true);
  });

  it("validateAgentParams accepts denied bootstrap with audit fields", () => {
    const payload = {
      message: "ping",
      idempotencyKey: "660e8400-e29b-41d4-a716-446655440001",
      sessionKey: "agent:main:main",
      linktrendGovernance: {
        bootstrap: {
          authorizationState: "denied",
          denialReasonCategory: "missing_tools",
          traceCorrelationId: "trace-2",
        },
        approvedTools: { toolNames: ["read"] },
        skillDeclaredTools: { toolNames: ["exec", "read"] },
      },
    };
    expect(validateAgentParams(payload)).toBe(true);
  });

  it("validateAgentParams accepts governance-only branch", () => {
    const payload = {
      linktrendGovernance: {
        bootstrap: {
          traceCorrelationId: "trace-3",
          authorizationState: "granted",
        },
        approvedTools: { toolNames: ["read"] },
      },
      sessionKey: "agent:main:main",
    };
    expect(validateAgentParams(payload)).toBe(true);
  });

  it("normalizeLinktrendGovernanceInbound maps mission.id and segment label/text", () => {
    const normalized = normalizeLinktrendGovernanceInbound({
      mission: { id: "m1", title: "T", summaryText: "S" },
      runtimeInstructions: {
        segments: [{ label: "L", text: "content" }],
      },
    });
    expect(normalized?.mission?.missionId).toBe("m1");
    expect(normalized?.mission?.title).toBe("T");
    expect(normalized?.runtimeInstructions?.segments?.[0]).toEqual({ title: "L", body: "content" });
  });

  it("resolveLinktrendGovernance uses mission title and toolsAllow", () => {
    const normalized = normalizeLinktrendGovernanceInbound({
      bootstrap: { authorizationState: "granted" },
      mission: { id: "mid", title: "Hello" },
      approvedTools: { toolNames: ["read"] },
    });
    const out = resolveLinktrendGovernance({
      cfg: {},
      governance: normalized,
      ctx: { runId: "r1" },
    });
    expect(out.toolsAllow).toEqual(["read"]);
    expect(out.extraSystemPrompt).toContain("Mission id: mid");
    expect(out.extraSystemPrompt).toContain("Mission title: Hello");
  });
});

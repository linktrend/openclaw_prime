import type { AgentCommandOpts } from "../agents/command/types.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { emitAgentEvent } from "../infra/agent-events.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import type { LinktrendGovernanceInput } from "./governance-types.js";

const log = createSubsystemLogger("linktrend/governance");

const GOV_EVENT_KIND = "linktrend.gov";

export type LinktrendGovernanceApplyContext = {
  runId: string;
  sessionKey?: string;
};

function emitGov(params: {
  runId: string;
  sessionKey?: string;
  phase: string;
  detail?: Record<string, unknown>;
}) {
  emitAgentEvent({
    runId: params.runId,
    stream: "lifecycle",
    sessionKey: params.sessionKey,
    data: {
      kind: GOV_EVENT_KIND,
      phase: params.phase,
      ts: Date.now(),
      ...params.detail,
    },
  });
}

function buildMissionInstructionBlock(input: LinktrendGovernanceInput): string | undefined {
  const parts: string[] = [];
  if (input.mission) {
    const m = input.mission;
    const header = "[LiNKtrend mission context — centrally governed, session-bound]";
    const lines: string[] = [header];
    if (m.missionId) {
      lines.push(`Mission id: ${m.missionId}`);
    }
    if (m.summaryText?.trim()) {
      lines.push(`Summary: ${m.summaryText.trim()}`);
    }
    if (m.objective && Object.keys(m.objective).length > 0) {
      lines.push(`Objective (structured): ${JSON.stringify(m.objective)}`);
    }
    parts.push(lines.join("\n"));
  }
  if (input.runtimeInstructions) {
    const ri = input.runtimeInstructions;
    const header = "[LiNKtrend runtime instructions — centrally governed, session-bound]";
    const lines: string[] = [header];
    if (ri.skillVersionRef) {
      lines.push(`Skill version ref (trace): ${ri.skillVersionRef}`);
    }
    if (ri.text?.trim()) {
      lines.push(ri.text.trim());
    }
    if (ri.segments?.length) {
      for (const seg of ri.segments) {
        const title = seg.title ? `${seg.title}: ` : "";
        lines.push(`${title}${seg.body}`);
      }
    }
    parts.push(lines.join("\n"));
  }
  if (parts.length === 0) {
    return undefined;
  }
  return parts.join("\n\n");
}

/**
 * Validates governance input against config, emits lifecycle signals, and returns
 * fields to merge onto the agent command (extraSystemPrompt fragment, toolsAllow).
 */
export function resolveLinktrendGovernance(params: {
  cfg: OpenClawConfig;
  governance?: LinktrendGovernanceInput;
  existingExtraSystemPrompt?: string;
  ctx: LinktrendGovernanceApplyContext;
}): { extraSystemPrompt?: string; toolsAllow?: string[] } {
  const { cfg, governance, existingExtraSystemPrompt, ctx } = params;
  const policy = cfg.linktrendGovernance;
  if (!governance && !policy?.enabled) {
    return {};
  }

  emitGov({
    runId: ctx.runId,
    sessionKey: ctx.sessionKey,
    phase: "bootstrap_check",
    detail: { hasPayload: Boolean(governance) },
  });

  if (policy?.enabled && policy.requireIngressGovernancePayload && !governance) {
    emitGov({
      runId: ctx.runId,
      sessionKey: ctx.sessionKey,
      phase: "bootstrap_denied",
      detail: { reason: "missing_governance_payload" },
    });
    throw new Error(
      "LiNKtrend governance: ingress governance payload is required by fork policy but was omitted.",
    );
  }

  if (!governance) {
    return {};
  }

  const auth = governance.bootstrap?.authorizationState;
  if (auth === "denied") {
    emitGov({
      runId: ctx.runId,
      sessionKey: ctx.sessionKey,
      phase: "bootstrap_denied",
      detail: {
        reasonCategory: governance.bootstrap?.denialReasonCategory ?? "authorization_denied",
      },
    });
    throw new Error(
      `LiNKtrend governance: bootstrap denied${
        governance.bootstrap?.denialReasonCategory
          ? ` (${governance.bootstrap.denialReasonCategory})`
          : ""
      }.`,
    );
  }

  if (policy?.requireBootstrapAuthorization && (!auth || auth === "pending")) {
    emitGov({
      runId: ctx.runId,
      sessionKey: ctx.sessionKey,
      phase: "bootstrap_denied",
      detail: { reason: "authorization_not_granted" },
    });
    throw new Error(
      "LiNKtrend governance: bootstrap authorization must be explicitly granted when requireBootstrapAuthorization is enabled.",
    );
  }

  if (policy?.requireMissionContext && !governance.mission) {
    emitGov({
      runId: ctx.runId,
      sessionKey: ctx.sessionKey,
      phase: "mission_context_missing",
    });
    throw new Error(
      "LiNKtrend governance: mission context is required by fork policy but was omitted.",
    );
  }

  emitGov({
    runId: ctx.runId,
    sessionKey: ctx.sessionKey,
    phase: "bootstrap_accepted",
    detail: {
      traceCorrelationId: governance.bootstrap?.traceCorrelationId,
      workerIdentityRef: governance.bootstrap?.workerIdentityRef,
    },
  });

  const block = buildMissionInstructionBlock(governance);
  if (block) {
    emitGov({
      runId: ctx.runId,
      sessionKey: ctx.sessionKey,
      phase: "context_injected",
      detail: {
        hasMission: Boolean(governance.mission),
        hasRuntimeInstructions: Boolean(governance.runtimeInstructions),
        skillVersionRef: governance.runtimeInstructions?.skillVersionRef,
      },
    });
  }

  let toolsAllow: string[] | undefined;
  const approved = governance.approvedTools;
  if (approved?.toolNames && approved.toolNames.length > 0) {
    toolsAllow = [...new Set(approved.toolNames.map((n) => n.trim()).filter(Boolean))];
    emitGov({
      runId: ctx.runId,
      sessionKey: ctx.sessionKey,
      phase: "capability_surface_set",
      detail: { toolCount: toolsAllow.length },
    });
  }

  const mergedPrompt = [existingExtraSystemPrompt?.trim(), block?.trim()]
    .filter(Boolean)
    .join("\n\n");

  return {
    extraSystemPrompt: mergedPrompt || undefined,
    toolsAllow,
  };
}

/**
 * Merges governance-derived fields into opts in place (bounded, session-scoped).
 */
export function applyLinktrendGovernanceToAgentCommand(
  opts: AgentCommandOpts,
  cfg: OpenClawConfig,
  ctx: LinktrendGovernanceApplyContext,
): void {
  try {
    const merged = resolveLinktrendGovernance({
      cfg,
      governance: opts.linktrendGovernance,
      existingExtraSystemPrompt: opts.extraSystemPrompt,
      ctx,
    });
    if (merged.extraSystemPrompt !== undefined) {
      opts.extraSystemPrompt = merged.extraSystemPrompt;
    }
    if (merged.toolsAllow !== undefined) {
      opts.toolsAllow = merged.toolsAllow;
    }
  } catch (err) {
    log.warn(`Governance resolution failed: ${String(err)}`);
    throw err;
  }
}

export { GOV_EVENT_KIND };

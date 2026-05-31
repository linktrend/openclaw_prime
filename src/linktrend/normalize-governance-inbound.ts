import type {
  LinktrendGovernanceInput,
  LinktrendRuntimeInstructionSegment,
} from "./governance-types.js";

type RawSegment = {
  title?: string;
  body?: string;
  label?: string;
  text?: string;
};

type RawMission = {
  id?: string;
  missionId?: string;
  title?: string;
  summaryText?: string;
  objective?: Record<string, unknown>;
};

type RawRuntime = {
  text?: string;
  skillVersionRef?: string;
  segments?: RawSegment[];
};

type RawGovernance = {
  bootstrap?: LinktrendGovernanceInput["bootstrap"];
  mission?: RawMission;
  runtimeInstructions?: RawRuntime;
  approvedTools?: LinktrendGovernanceInput["approvedTools"];
  skillDeclaredTools?: { toolNames?: string[] };
  skillName?: string;
  skillVersion?: string;
  skillId?: string;
  skillIndex?: unknown;
};

function normalizeSegment(seg: RawSegment): LinktrendRuntimeInstructionSegment | undefined {
  const body = (seg.body ?? seg.text ?? "").trim();
  if (!body) {
    return undefined;
  }
  const title = (seg.title ?? seg.label)?.trim();
  return { title: title || undefined, body };
}

/**
 * Maps monorepo- and hook/gateway-shaped `linktrendGovernance` objects to the
 * canonical `LinktrendGovernanceInput` used by `resolveLinktrendGovernance`.
 * Call only after JSON schema validation.
 */
export function normalizeLinktrendGovernanceInbound(
  raw: LinktrendGovernanceInput | RawGovernance | undefined,
): LinktrendGovernanceInput | undefined {
  if (!raw) {
    return undefined;
  }
  const g = raw as RawGovernance;
  const mission = g.mission
    ? {
        missionId: g.mission.missionId ?? g.mission.id,
        title: g.mission.title,
        summaryText: g.mission.summaryText,
        objective: g.mission.objective,
      }
    : undefined;
  let runtimeInstructions: LinktrendGovernanceInput["runtimeInstructions"] = undefined;
  if (g.runtimeInstructions?.segments?.length) {
    const segments: LinktrendRuntimeInstructionSegment[] = [];
    for (const s of g.runtimeInstructions.segments) {
      const n = normalizeSegment(s);
      if (n) {
        segments.push(n);
      }
    }
    runtimeInstructions = {
      text: g.runtimeInstructions.text,
      skillVersionRef: g.runtimeInstructions.skillVersionRef,
      segments: segments.length ? segments : undefined,
    };
  } else if (g.runtimeInstructions) {
    runtimeInstructions = {
      text: g.runtimeInstructions.text,
      skillVersionRef: g.runtimeInstructions.skillVersionRef,
    };
  }
  return {
    bootstrap: g.bootstrap,
    mission,
    runtimeInstructions,
    approvedTools: g.approvedTools,
    skillDeclaredTools: g.skillDeclaredTools,
    skillName: g.skillName,
    skillVersion: g.skillVersion,
    skillId: g.skillId,
    skillIndex: g.skillIndex,
  };
}

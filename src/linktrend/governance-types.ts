/**
 * LiNKtrend governance payloads cross the engine boundary from bot-runtime.
 * They are session/runtime inputs only — not central truth (see LiNKtrend fork PRD).
 */

export type LinktrendBootstrapAuthorization = "granted" | "denied" | "pending";

export type LinktrendBootstrapContext = {
  /** Opaque worker identity reference from the central system (trace-oriented). */
  workerIdentityRef?: string;
  authorizationState: LinktrendBootstrapAuthorization;
  /** Correlation id for traces; safe to log at info level. */
  traceCorrelationId?: string;
  /** Optional short reason category when denied (no secrets). */
  denialReasonCategory?: string;
};

export type LinktrendMissionContext = {
  missionId?: string;
  /** Structured mission payload (object); avoid embedding secrets. */
  objective?: Record<string, unknown>;
  /** Short human summary for prompts (bounded). */
  summaryText?: string;
};

export type LinktrendRuntimeInstructionSegment = {
  title?: string;
  body: string;
};

export type LinktrendRuntimeInstructions = {
  /** Single flattened instruction layer (preferred for v1). */
  text?: string;
  segments?: LinktrendRuntimeInstructionSegment[];
  /** Centrally resolved skill version reference for traceability only. */
  skillVersionRef?: string;
};

export type LinktrendApprovedToolSurface = {
  /**
   * When set, maps to the embedded runner tool allow-list (only these tool names are exposed).
   */
  toolNames?: string[];
  /**
   * When true and toolNames is set, the model sees only the approved subset.
   * When false/omitted with toolNames set, same behavior (explicit list wins).
   */
  restrictToApprovedList?: boolean;
};

export type LinktrendGovernanceInput = {
  bootstrap?: LinktrendBootstrapContext;
  mission?: LinktrendMissionContext;
  runtimeInstructions?: LinktrendRuntimeInstructions;
  approvedTools?: LinktrendApprovedToolSurface;
};

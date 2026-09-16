/**
 * PKT-04 source-only non-coding evaluation and transient routing.
 *
 * Fail-closed by default. Exact model IDs stay candidate-only until founder
 * approval. Adapters must not call live providers, read credentials, or persist
 * a one-response override into profile/session defaults.
 */

export const NONCODING_ROUTE_VERSION = "2026-08-24-transient-noncoding-routing-v1" as const;

export const NONCODING_ACTIVATION_PENDING_FOUNDER_APPROVAL =
  "disabled_pending_founder_approval" as const;

export type NonCodingRouteTag =
  | "conversation"
  | "routine"
  | "normal"
  | "difficult"
  | "document"
  | "coding_excluded";

export type NonCodingClassificationSource = "deterministic" | "classifier" | "fail_closed";

export type NonCodingFailureKind = "provider_model" | "infrastructure" | "quality";

export type NonCodingActivationState = typeof NONCODING_ACTIVATION_PENDING_FOUNDER_APPROVAL;

export type NonCodingRouteConfig = {
  version: typeof NONCODING_ROUTE_VERSION;
  liveMutationAllowed: false;
  exactModelIdsApproved: false;
  paidRouteActivationAllowed: false;
  sourceOnlyEvaluation: true;
  activationState: NonCodingActivationState;
  classifier: {
    obviousRequestsSkipClassifier: true;
    ambiguousRequestsOnly: true;
    maxContextChars: 2000;
    invalidOrFailedClassification: "conversation";
  };
  defaults: {
    primary: string;
    reasoningEffort: "high";
    fallbacks: readonly string[];
  };
  documentCandidate: {
    ref: string;
    enabled: false;
    capabilityStatus: "approved_unverified";
    requiresFirstProductionProofReceipt: true;
    alternatePaidDocumentRoutingAllowed: false;
  };
  transientOverride: {
    persisted: false;
    fallbackMaxHops: 1;
    infrastructureFailure: "retry_same_model";
    qualityFailureRequiresLoggedFailure: true;
  };
};

export type NonCodingRequest = {
  text: string;
  transcript?: unknown;
  privateMemory?: unknown;
  credentials?: unknown;
};

export type NonCodingClassifierResult =
  | { ok: true; tag: NonCodingRouteTag }
  | { ok: false; reason: string };

export type NonCodingClassifierAdapter = {
  classify: (boundedText: string) => NonCodingClassifierResult;
};

export type NonCodingQualityLog = {
  qualityFailureLogged: boolean;
};

export type NonCodingClassification = {
  tag: NonCodingRouteTag;
  source: NonCodingClassificationSource;
  classifierCalled: boolean;
  boundedContextChars: number;
  reason: string;
};

export type TransientNonCodingRoute = {
  persist: false;
  activationState: NonCodingActivationState;
  paidRouteActivated: false;
  liveProviderSelected: false;
  tag: NonCodingRouteTag;
  candidatePrimaryRef: string;
  candidateFallbackRefs: readonly string[];
  reasoningEffort: "high";
  documentRouteEnabled: false;
  profileDefaultMutated: false;
};

export type NonCodingFallbackDecision =
  | {
      action: "retry_same_model";
      hopsUsed: number;
      activationState: NonCodingActivationState;
      liveProviderSelected: false;
    }
  | {
      action: "advance_candidate_fallback";
      hopsUsed: number;
      candidateRef: string;
      activationState: NonCodingActivationState;
      liveProviderSelected: false;
    }
  | {
      action: "refuse";
      hopsUsed: number;
      reason: string;
      activationState: NonCodingActivationState;
      liveProviderSelected: false;
    };

export type NonCodingEvalDimension =
  | "quality"
  | "instructionFollowing"
  | "safety"
  | "latency"
  | "cost";

export type NonCodingEvalScore = Record<NonCodingEvalDimension, number>;

export type NonCodingEvalCase = {
  id: string;
  prompt: string;
  tag: NonCodingRouteTag;
  candidateRef: string;
};

export type NonCodingEvalScorer = {
  score: (evalCase: NonCodingEvalCase) => NonCodingEvalScore;
};

export type NonCodingEvalRecord = {
  sourceOnly: true;
  liveModelCalled: false;
  exactModelIdsApproved: false;
  paidRouteActivated: false;
  activationState: NonCodingActivationState;
  cases: readonly (NonCodingEvalCase & { scores: NonCodingEvalScore })[];
  namedCandidateRefs: readonly string[];
};

export type NonCodingLatencyStage =
  | "ingress"
  | "lock_context"
  | "route"
  | "tools"
  | "provider"
  | "delivery";

const FORBIDDEN_FALLBACK_MARKERS = ["glm", "z-ai", "zai/"] as const;
const PAID_DOCUMENT_MARKERS = ["minimax"] as const;

const OBVIOUS_RULES: readonly { tag: NonCodingRouteTag; pattern: RegExp }[] = [
  {
    tag: "coding_excluded",
    pattern:
      /\b(diff|pull request|\bpr\b|typescript|python|compile|refactor|codebase|eslint|function\b|git commit)\b/i,
  },
  {
    tag: "document",
    pattern: /\b(pdf|document models?|invoice pdf|scanned document)\b/i,
  },
  {
    tag: "conversation",
    pattern: /^(hi|hello|hey|thanks|thank you|good morning|good night)[.!?]?$/i,
  },
  {
    tag: "routine",
    pattern: /\b(summarize|rewrite|translate|format|shorten|bullet)\b/i,
  },
  {
    tag: "difficult",
    pattern: /\b(trade-?offs?|strategy|architecture|plan a|multi-step analysis)\b/i,
  },
];

export function defaultNonCodingRouteConfig(overrides?: {
  primary?: string;
  fallbacks?: readonly string[];
  documentRef?: string;
}): NonCodingRouteConfig {
  return {
    version: NONCODING_ROUTE_VERSION,
    liveMutationAllowed: false,
    exactModelIdsApproved: false,
    paidRouteActivationAllowed: false,
    sourceOnlyEvaluation: true,
    activationState: NONCODING_ACTIVATION_PENDING_FOUNDER_APPROVAL,
    classifier: {
      obviousRequestsSkipClassifier: true,
      ambiguousRequestsOnly: true,
      maxContextChars: 2_000,
      invalidOrFailedClassification: "conversation",
    },
    defaults: {
      primary: overrides?.primary ?? "openai/gpt-5.6-luna",
      reasoningEffort: "high",
      fallbacks: overrides?.fallbacks ?? [
        "openrouter/openai/gpt-5.6-luna",
        "moonshot/kimi-k2.6",
        "google/gemini-3.1-flash-lite",
      ],
    },
    documentCandidate: {
      ref: overrides?.documentRef ?? "openrouter/minimax/minimax-m3",
      enabled: false,
      capabilityStatus: "approved_unverified",
      requiresFirstProductionProofReceipt: true,
      alternatePaidDocumentRoutingAllowed: false,
    },
    transientOverride: {
      persisted: false,
      fallbackMaxHops: 1,
      infrastructureFailure: "retry_same_model",
      qualityFailureRequiresLoggedFailure: true,
    },
  };
}

export function validateNonCodingRouteConfig(config: NonCodingRouteConfig): string[] {
  const errors: string[] = [];
  if (config.liveMutationAllowed !== false) errors.push("liveMutationAllowed must be false");
  if (config.exactModelIdsApproved !== false) errors.push("exactModelIdsApproved must be false");
  if (config.paidRouteActivationAllowed !== false) {
    errors.push("paidRouteActivationAllowed must be false");
  }
  if (config.sourceOnlyEvaluation !== true) errors.push("sourceOnlyEvaluation must be true");
  if (config.activationState !== NONCODING_ACTIVATION_PENDING_FOUNDER_APPROVAL) {
    errors.push("activationState must remain disabled_pending_founder_approval");
  }
  if (config.classifier.obviousRequestsSkipClassifier !== true) {
    errors.push("obviousRequestsSkipClassifier must be true");
  }
  if (config.classifier.ambiguousRequestsOnly !== true) {
    errors.push("ambiguousRequestsOnly must be true");
  }
  if (config.classifier.maxContextChars !== 2_000) errors.push("maxContextChars must be 2000");
  if (config.defaults.fallbacks.some((ref) => isForbiddenFallbackRef(ref))) {
    errors.push("GLM must not be a non-coding fallback");
  }
  if (config.defaults.fallbacks.includes(config.documentCandidate.ref)) {
    errors.push("document candidate must not be a default fallback");
  }
  if (config.documentCandidate.enabled !== false)
    errors.push("document candidate must be disabled");
  if (config.transientOverride.persisted !== false) {
    errors.push("transient overrides must not persist");
  }
  if (config.transientOverride.fallbackMaxHops !== 1) errors.push("fallbackMaxHops must be 1");
  return errors;
}

export function isForbiddenFallbackRef(ref: string): boolean {
  const lower = ref.toLowerCase();
  return FORBIDDEN_FALLBACK_MARKERS.some((marker) => lower.includes(marker));
}

export function isPaidDocumentRef(ref: string): boolean {
  const lower = ref.toLowerCase();
  return PAID_DOCUMENT_MARKERS.some((marker) => lower.includes(marker));
}

export function boundClassifierContext(text: string, maxContextChars: number): string {
  return text.slice(0, maxContextChars);
}

export function classifyNonCodingRequest(
  request: NonCodingRequest,
  config: NonCodingRouteConfig,
  classifier?: NonCodingClassifierAdapter,
): NonCodingClassification {
  const text = request.text.trim();
  for (const rule of OBVIOUS_RULES) {
    if (rule.pattern.test(text)) {
      return {
        tag: rule.tag,
        source: "deterministic",
        classifierCalled: false,
        boundedContextChars: 0,
        reason: `obvious_${rule.tag}`,
      };
    }
  }

  if (config.classifier.ambiguousRequestsOnly !== true) {
    return failClosedConversation("classifier_policy_invalid");
  }

  if (!classifier) {
    return failClosedConversation("ambiguous_without_classifier_adapter");
  }

  const bounded = boundClassifierContext(text, config.classifier.maxContextChars);
  if (request.transcript !== undefined || request.privateMemory !== undefined) {
    return failClosedConversation("classifier_context_included_forbidden_fields");
  }
  if (request.credentials !== undefined) {
    return failClosedConversation("classifier_context_included_credentials");
  }

  const result = classifier.classify(bounded);
  if (!result.ok) {
    return failClosedConversation(`classifier_failed:${result.reason}`);
  }
  if (!isRouteTag(result.tag)) {
    return failClosedConversation("classifier_invalid_tag");
  }
  return {
    tag: result.tag,
    source: "classifier",
    classifierCalled: true,
    boundedContextChars: bounded.length,
    reason: "ambiguous_classified",
  };
}

export function resolveTransientNonCodingRoute(
  request: NonCodingRequest,
  config: NonCodingRouteConfig,
  classifier?: NonCodingClassifierAdapter,
): TransientNonCodingRoute {
  const configErrors = validateNonCodingRouteConfig(config);
  if (configErrors.length > 0) {
    throw new Error(`non-coding route config fail-closed: ${configErrors.join("; ")}`);
  }
  const classification = classifyNonCodingRequest(request, config, classifier);
  return {
    persist: false,
    activationState: config.activationState,
    paidRouteActivated: false,
    liveProviderSelected: false,
    tag: classification.tag,
    candidatePrimaryRef: config.defaults.primary,
    candidateFallbackRefs: config.defaults.fallbacks,
    reasoningEffort: config.defaults.reasoningEffort,
    documentRouteEnabled: false,
    profileDefaultMutated: false,
  };
}

export function resolveNonCodingFallback(params: {
  config: NonCodingRouteConfig;
  kind: NonCodingFailureKind;
  hopsUsed: number;
  qualityLog?: NonCodingQualityLog;
}): NonCodingFallbackDecision {
  const { config, kind, hopsUsed } = params;
  const activationState = config.activationState;
  if (kind === "infrastructure") {
    return {
      action: "retry_same_model",
      hopsUsed,
      activationState,
      liveProviderSelected: false,
    };
  }
  if (kind === "quality") {
    const qualityFallbackBlocked =
      config.transientOverride.qualityFailureRequiresLoggedFailure &&
      !params.qualityLog?.qualityFailureLogged;
    if (qualityFallbackBlocked) {
      return {
        action: "refuse",
        hopsUsed,
        reason: "quality_fallback_requires_logged_failure",
        activationState,
        liveProviderSelected: false,
      };
    }
  }
  if (hopsUsed >= config.transientOverride.fallbackMaxHops) {
    return {
      action: "refuse",
      hopsUsed,
      reason: "fallback_max_hops_exhausted",
      activationState,
      liveProviderSelected: false,
    };
  }
  const next = config.defaults.fallbacks[hopsUsed];
  if (!next) {
    return {
      action: "refuse",
      hopsUsed,
      reason: "no_candidate_fallback",
      activationState,
      liveProviderSelected: false,
    };
  }
  if (isForbiddenFallbackRef(next) || isPaidDocumentRef(next)) {
    return {
      action: "refuse",
      hopsUsed,
      reason: "unapproved_or_paid_document_fallback",
      activationState,
      liveProviderSelected: false,
    };
  }
  if (config.exactModelIdsApproved !== false || config.paidRouteActivationAllowed !== false) {
    return {
      action: "refuse",
      hopsUsed,
      reason: "activation_gate_invalid",
      activationState,
      liveProviderSelected: false,
    };
  }
  return {
    action: "advance_candidate_fallback",
    hopsUsed: hopsUsed + 1,
    candidateRef: next,
    activationState,
    liveProviderSelected: false,
  };
}

export function resolveSourceOnlyNonCodingCatalog(config: NonCodingRouteConfig): {
  discoveryCalled: false;
  liveProviderSelected: false;
  paidRouteActivated: false;
  activationState: NonCodingActivationState;
  candidateSlots: {
    primary: string;
    fallbacks: readonly string[];
    document: { ref: string; enabled: false };
  };
} {
  const errors = validateNonCodingRouteConfig(config);
  if (errors.length > 0) {
    throw new Error(`non-coding catalog fail-closed: ${errors.join("; ")}`);
  }
  return {
    discoveryCalled: false,
    liveProviderSelected: false,
    paidRouteActivated: false,
    activationState: config.activationState,
    candidateSlots: {
      primary: config.defaults.primary,
      fallbacks: config.defaults.fallbacks,
      document: { ref: config.documentCandidate.ref, enabled: false },
    },
  };
}

export function admitTransientNonCodingRuntimeOverlay(params: {
  publishedDefaults: { primary?: string; fallbacks?: readonly string[] };
  route: TransientNonCodingRoute;
}): {
  persist: false;
  mutatedPublishedDefaults: false;
  liveProviderSelected: false;
  overlay: TransientNonCodingRoute;
  publishedDefaults: { primary?: string; fallbacks?: readonly string[] };
} {
  if (params.route.persist !== false || params.route.profileDefaultMutated !== false) {
    throw new Error("transient non-coding overlay must not persist");
  }
  if (params.route.liveProviderSelected !== false) {
    throw new Error("transient non-coding overlay must not select a live provider");
  }
  return {
    persist: false,
    mutatedPublishedDefaults: false,
    liveProviderSelected: false,
    overlay: params.route,
    publishedDefaults: params.publishedDefaults,
  };
}

export function evaluateNonCodingCandidates(params: {
  config: NonCodingRouteConfig;
  cases: readonly NonCodingEvalCase[];
  scorer: NonCodingEvalScorer;
}): NonCodingEvalRecord {
  const errors = validateNonCodingRouteConfig(params.config);
  if (errors.length > 0) {
    throw new Error(`non-coding evaluation fail-closed: ${errors.join("; ")}`);
  }
  return {
    sourceOnly: true,
    liveModelCalled: false,
    exactModelIdsApproved: false,
    paidRouteActivated: false,
    activationState: params.config.activationState,
    cases: params.cases.map((evalCase) => ({
      ...evalCase,
      scores: params.scorer.score(evalCase),
    })),
    namedCandidateRefs: [params.config.defaults.primary, ...params.config.defaults.fallbacks],
  };
}

export function recordBodyFreeLatency(
  stage: NonCodingLatencyStage,
  elapsedMs: number,
): { stage: NonCodingLatencyStage; elapsedMs: number } {
  return { stage, elapsedMs };
}

function failClosedConversation(reason: string): NonCodingClassification {
  return {
    tag: "conversation",
    source: "fail_closed",
    classifierCalled: false,
    boundedContextChars: 0,
    reason,
  };
}

function isRouteTag(value: string): value is NonCodingRouteTag {
  return (
    value === "conversation" ||
    value === "routine" ||
    value === "normal" ||
    value === "difficult" ||
    value === "document" ||
    value === "coding_excluded"
  );
}

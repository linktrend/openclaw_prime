/**
 * PKT-04 non-coding route authority.
 *
 * This is a source-only, non-live contract. It describes candidate slots;
 * callers must not write these values into Lisa's persistent defaults/session.
 * Exact model IDs and paid-route activation stay disabled pending founder approval.
 */
export const LISA_NONCODING_ROUTING_VERSION = "2026-08-24-transient-noncoding-routing-v1" as const;

export const LISA_NONCODING_ROUTING = {
  version: LISA_NONCODING_ROUTING_VERSION,
  liveMutationAllowed: false,
  exactModelIdsApproved: false,
  paidRouteActivationAllowed: false,
  sourceOnlyEvaluation: true,
  activationState: "disabled_pending_founder_approval",
  classifier: {
    obviousRequestsSkipClassifier: true,
    ambiguousRequestsOnly: true,
    maxContextChars: 2_000,
    invalidOrFailedClassification: "conversation",
  },
  defaults: {
    primary: "openai/gpt-5.6-luna",
    reasoningEffort: "high",
    fallbacks: [
      "openrouter/openai/gpt-5.6-luna",
      "moonshot/kimi-k2.6",
      "google/gemini-3.1-flash-lite",
    ],
  },
  documentCandidate: {
    ref: "openrouter/minimax/minimax-m3",
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
} as const;

export type LisaNonCodingRouting = typeof LISA_NONCODING_ROUTING;

export function validateLisaNonCodingRouting(
  routing: LisaNonCodingRouting = LISA_NONCODING_ROUTING,
): string[] {
  const errors: string[] = [];
  if (routing.liveMutationAllowed !== false) errors.push("liveMutationAllowed must be false");
  if (routing.exactModelIdsApproved !== false) errors.push("exactModelIdsApproved must be false");
  if (routing.paidRouteActivationAllowed !== false) {
    errors.push("paidRouteActivationAllowed must be false");
  }
  if (routing.sourceOnlyEvaluation !== true) errors.push("sourceOnlyEvaluation must be true");
  if (routing.activationState !== "disabled_pending_founder_approval") {
    errors.push("activationState must remain disabled_pending_founder_approval");
  }
  if (routing.classifier.obviousRequestsSkipClassifier !== true) {
    errors.push("obviousRequestsSkipClassifier must be true");
  }
  if (routing.classifier.ambiguousRequestsOnly !== true) {
    errors.push("ambiguousRequestsOnly must be true");
  }
  if (routing.classifier.maxContextChars !== 2_000) errors.push("maxContextChars must be 2000");
  if (routing.defaults.primary !== "openai/gpt-5.6-luna") {
    errors.push("primary must be openai/gpt-5.6-luna");
  }
  if (routing.defaults.fallbacks.includes("openrouter/z-ai/glm-5.2")) {
    errors.push("GLM must not be a non-coding fallback");
  }
  if (routing.defaults.fallbacks.includes(routing.documentCandidate.ref)) {
    errors.push("document candidate must not be a default fallback");
  }
  if (routing.documentCandidate.enabled !== false)
    errors.push("document candidate must be disabled");
  if (routing.documentCandidate.capabilityStatus !== "approved_unverified") {
    errors.push("document candidate must remain approved_unverified");
  }
  if (routing.transientOverride.persisted !== false)
    errors.push("transient overrides must not persist");
  if (routing.transientOverride.fallbackMaxHops !== 1) errors.push("fallbackMaxHops must be 1");
  return errors;
}

export function lisaNonCodingFallbackRefs(
  routing: LisaNonCodingRouting = LISA_NONCODING_ROUTING,
): readonly string[] {
  return routing.defaults.fallbacks;
}

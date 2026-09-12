import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LISA_NONCODING_ROUTING,
  lisaNonCodingFallbackRefs,
  validateLisaNonCodingRouting,
} from "../../linkbots/lisa/ops/model-routing.ts";
import {
  admitTransientNonCodingRuntimeOverlay,
  boundClassifierContext,
  classifyNonCodingRequest,
  defaultNonCodingRouteConfig,
  evaluateNonCodingCandidates,
  recordBodyFreeLatency,
  resolveNonCodingFallback,
  resolveSourceOnlyNonCodingCatalog,
  resolveTransientNonCodingRoute,
  validateNonCodingRouteConfig,
  type NonCodingClassifierAdapter,
  type NonCodingEvalScorer,
  type NonCodingRouteConfig,
} from "./noncoding-route.js";

function forbiddenConfig(
  patch: (config: NonCodingRouteConfig) => NonCodingRouteConfig,
): NonCodingRouteConfig {
  return patch(defaultNonCodingRouteConfig());
}

const deterministicScorer: NonCodingEvalScorer = {
  score: (evalCase) => {
    const base = evalCase.tag === "difficult" ? 8 : 7;
    return {
      quality: base,
      instructionFollowing: base,
      safety: 9,
      latency: evalCase.candidateRef.includes("flash") ? 9 : 6,
      cost: evalCase.candidateRef.includes("flash") ? 8 : 5,
    };
  },
};

describe("PKT-04 source-only non-coding route", () => {
  it("keeps activation disabled and forbids GLM or MiniMax fallbacks", () => {
    const config = defaultNonCodingRouteConfig();
    expect(validateNonCodingRouteConfig(config)).toEqual([]);
    expect(config.exactModelIdsApproved).toBe(false);
    expect(config.paidRouteActivationAllowed).toBe(false);
    expect(config.activationState).toBe("disabled_pending_founder_approval");
    expect(config.defaults.fallbacks.some((ref) => /glm/i.test(ref))).toBe(false);
    expect(config.defaults.fallbacks).not.toContain(config.documentCandidate.ref);
  });

  it("routes obvious requests without calling a classifier", () => {
    const classifier: NonCodingClassifierAdapter = {
      classify: () => {
        throw new Error("classifier must not run for obvious requests");
      },
    };
    const conversation = classifyNonCodingRequest(
      { text: "hello" },
      defaultNonCodingRouteConfig(),
      classifier,
    );
    const routine = classifyNonCodingRequest(
      { text: "Summarize this paragraph for me" },
      defaultNonCodingRouteConfig(),
      classifier,
    );
    const coding = classifyNonCodingRequest(
      { text: "Please refactor this TypeScript function" },
      defaultNonCodingRouteConfig(),
      classifier,
    );
    expect(conversation).toMatchObject({
      tag: "conversation",
      source: "deterministic",
      classifierCalled: false,
    });
    expect(routine).toMatchObject({
      tag: "routine",
      source: "deterministic",
      classifierCalled: false,
    });
    expect(coding).toMatchObject({
      tag: "coding_excluded",
      source: "deterministic",
      classifierCalled: false,
    });
  });

  it("calls an injected fake classifier only for ambiguous text and bounds context", () => {
    let seen = "";
    const classifier: NonCodingClassifierAdapter = {
      classify: (boundedText) => {
        seen = boundedText;
        return { ok: true, tag: "normal" };
      },
    };
    const longText = `What should I consider here? ${"x".repeat(2500)}`;
    const result = classifyNonCodingRequest(
      { text: longText },
      defaultNonCodingRouteConfig(),
      classifier,
    );
    expect(result).toMatchObject({
      tag: "normal",
      source: "classifier",
      classifierCalled: true,
    });
    expect(seen.length).toBe(2000);
    expect(boundClassifierContext(longText, 2000).length).toBe(2000);
  });

  it("fails closed to conversation when classification is invalid or forbidden context is supplied", () => {
    const invalid: NonCodingClassifierAdapter = {
      classify: () => ({ ok: false, reason: "timeout" }),
    };
    const failed = classifyNonCodingRequest(
      { text: "What should I consider here?" },
      defaultNonCodingRouteConfig(),
      invalid,
    );
    expect(failed).toMatchObject({
      tag: "conversation",
      source: "fail_closed",
      classifierCalled: false,
    });
    const leaked = classifyNonCodingRequest(
      { text: "What should I consider here?", transcript: "secret-thread" },
      defaultNonCodingRouteConfig(),
      { classify: () => ({ ok: true, tag: "normal" }) },
    );
    expect(leaked.reason).toBe("classifier_context_included_forbidden_fields");
  });

  it("returns a non-persisted overlay and never selects a live provider", () => {
    const route = resolveTransientNonCodingRoute({ text: "hello" }, defaultNonCodingRouteConfig());
    expect(route.persist).toBe(false);
    expect(route.liveProviderSelected).toBe(false);
    expect(route.paidRouteActivated).toBe(false);
    expect(route.profileDefaultMutated).toBe(false);
    expect(route.activationState).toBe("disabled_pending_founder_approval");
  });

  it("retries infrastructure failures on the same candidate and requires a logged quality failure", () => {
    const config = defaultNonCodingRouteConfig();
    expect(resolveNonCodingFallback({ config, kind: "infrastructure", hopsUsed: 0 })).toMatchObject(
      {
        action: "retry_same_model",
        liveProviderSelected: false,
      },
    );
    expect(
      resolveNonCodingFallback({
        config,
        kind: "quality",
        hopsUsed: 0,
        qualityLog: { qualityFailureLogged: false },
      }),
    ).toMatchObject({
      action: "refuse",
      reason: "quality_fallback_requires_logged_failure",
    });
    expect(
      resolveNonCodingFallback({
        config,
        kind: "provider_model",
        hopsUsed: 0,
      }),
    ).toMatchObject({
      action: "advance_candidate_fallback",
      hopsUsed: 1,
      candidateRef: "openrouter/openai/gpt-5.6-luna",
      liveProviderSelected: false,
      activationState: "disabled_pending_founder_approval",
    });
    expect(
      resolveNonCodingFallback({
        config,
        kind: "provider_model",
        hopsUsed: 1,
      }),
    ).toMatchObject({
      action: "refuse",
      reason: "fallback_max_hops_exhausted",
    });
  });

  it("records source-only evaluation without live model calls", () => {
    const config = defaultNonCodingRouteConfig();
    const record = evaluateNonCodingCandidates({
      config,
      scorer: deterministicScorer,
      cases: [
        {
          id: "routine-luna-low-vs-medium",
          prompt: "Summarize this paragraph",
          tag: "routine",
          candidateRef: config.defaults.primary,
        },
        {
          id: "difficult-luna-high",
          prompt: "Plan a multi-step analysis of trade-offs",
          tag: "difficult",
          candidateRef: config.defaults.primary,
        },
      ],
    });
    expect(record.liveModelCalled).toBe(false);
    expect(record.exactModelIdsApproved).toBe(false);
    expect(record.namedCandidateRefs).toContain("openai/gpt-5.6-luna");
    expect(record.cases).toHaveLength(2);
    expect(record.cases[0]?.scores.safety).toBe(9);
  });

  it("fail-closes catalog discovery and runtime overlay against published defaults", () => {
    const config = defaultNonCodingRouteConfig();
    const catalog = resolveSourceOnlyNonCodingCatalog(config);
    expect(catalog.discoveryCalled).toBe(false);
    expect(catalog.paidRouteActivated).toBe(false);
    const publishedDefaults = {
      primary: "openai/gpt-5.6-luna",
      fallbacks: ["openrouter/z-ai/glm-5.2"],
    };
    const overlay = admitTransientNonCodingRuntimeOverlay({
      publishedDefaults,
      route: resolveTransientNonCodingRoute({ text: "hello" }, config),
    });
    expect(overlay.mutatedPublishedDefaults).toBe(false);
    expect(overlay.publishedDefaults).toEqual(publishedDefaults);
    expect(recordBodyFreeLatency("route", 3)).toEqual({ stage: "route", elapsedMs: 3 });
  });

  it("refuses invalid activation gates instead of silently enabling paid or live routes", () => {
    expect(() =>
      validateNonCodingRouteConfig(
        forbiddenConfig((config) => ({ ...config, exactModelIdsApproved: true as false })),
      ),
    ).not.toThrow();
    expect(
      validateNonCodingRouteConfig(
        forbiddenConfig((config) => ({ ...config, exactModelIdsApproved: true as false })),
      ),
    ).toContain("exactModelIdsApproved must be false");
  });

  it("keeps the Lisa source contract aligned and founder-gated", () => {
    expect(validateLisaNonCodingRouting()).toEqual([]);
    expect(LISA_NONCODING_ROUTING).toMatchObject({
      liveMutationAllowed: false,
      exactModelIdsApproved: false,
      paidRouteActivationAllowed: false,
      activationState: "disabled_pending_founder_approval",
    });
    expect(lisaNonCodingFallbackRefs()).toEqual(defaultNonCodingRouteConfig().defaults.fallbacks);
    const raw = JSON.parse(
      readFileSync(
        path.join(
          path.dirname(fileURLToPath(import.meta.url)),
          "../../linkbots/lisa/ops/model-routing.contract.json",
        ),
        "utf8",
      ),
    ) as { nonCodingRouting: typeof LISA_NONCODING_ROUTING };
    expect(raw.nonCodingRouting).toEqual(LISA_NONCODING_ROUTING);
  });
});

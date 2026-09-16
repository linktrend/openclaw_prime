import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LISA_NONCODING_ROUTING,
  lisaNonCodingFallbackRefs,
  validateLisaNonCodingRouting,
} from "./model-routing.ts";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("Lisa PKT-04 non-coding routing", () => {
  it("is non-live, bounded, and fail-closed pending founder approval", () => {
    expect(validateLisaNonCodingRouting()).toEqual([]);
    expect(LISA_NONCODING_ROUTING.liveMutationAllowed).toBe(false);
    expect(LISA_NONCODING_ROUTING.exactModelIdsApproved).toBe(false);
    expect(LISA_NONCODING_ROUTING.paidRouteActivationAllowed).toBe(false);
    expect(LISA_NONCODING_ROUTING.activationState).toBe("disabled_pending_founder_approval");
    expect(LISA_NONCODING_ROUTING.classifier.maxContextChars).toBe(2_000);
    expect(LISA_NONCODING_ROUTING.transientOverride.persisted).toBe(false);
    expect(LISA_NONCODING_ROUTING.documentCandidate.enabled).toBe(false);
    expect(lisaNonCodingFallbackRefs()).toEqual([
      "openrouter/openai/gpt-5.6-luna",
      "moonshot/kimi-k2.6",
      "google/gemini-3.1-flash-lite",
    ]);
  });

  it("keeps the source JSON aligned without enabling live mutation", () => {
    const raw = JSON.parse(
      readFileSync(path.join(here, "model-routing.contract.json"), "utf8"),
    ) as { nonCodingRouting: typeof LISA_NONCODING_ROUTING };
    expect(raw.nonCodingRouting).toEqual(LISA_NONCODING_ROUTING);
  });
});

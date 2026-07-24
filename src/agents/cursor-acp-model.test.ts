import { describe, expect, it } from "vitest";
import {
  expandCursorAcpGrokModelCandidates,
  resolveCursorAcpGrokHarnessCandidates,
} from "./cursor-acp-model.js";

describe("cursor-acp-model", () => {
  it.each([
    "cursor-grok-4.5-low",
    "cursor-grok-4.5-low-fast",
    "cursor-grok-4.5-medium",
    "cursor-grok-4.5-medium-fast",
    "cursor-grok-4.5-high",
    "cursor-grok-4.5-high-fast",
  ])("maps CLI alias %s to canonical high-fast", (model) => {
    expect(expandCursorAcpGrokModelCandidates(model)).toEqual(["grok-4.5[effort=high,fast=true]"]);
  });

  it("never returns bare grok-4.5", () => {
    expect(expandCursorAcpGrokModelCandidates("grok-4.5")).toEqual([
      "grok-4.5[effort=high,fast=true]",
    ]);
  });

  it.each([
    "grok-4.5[effort=medium,fast=false]",
    "grok-4.5[effort=high,fast=false]",
    "GROK-4.5[EFFORT=HIGH,FAST=TRUE]",
  ])("canonicalizes bracketed Grok variant %s", (model) => {
    expect(expandCursorAcpGrokModelCandidates(model)).toEqual(["grok-4.5[effort=high,fast=true]"]);
  });

  it("keeps advertised high-fast as-is", () => {
    expect(expandCursorAcpGrokModelCandidates("grok-4.5[effort=high,fast=true]")).toEqual([
      "grok-4.5[effort=high,fast=true]",
    ]);
  });

  it("exposes harness defaults as high-fast first", () => {
    expect(resolveCursorAcpGrokHarnessCandidates()).toEqual(["grok-4.5[effort=high,fast=true]"]);
  });
});

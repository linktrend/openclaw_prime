/**
 * Colocated Brain fake contract smoke (imports local runtime only).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BRAIN_TOOL_NAMES, createBrainFake, validateBrainPayload } from "./runtime.mjs";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("extensions/linkbrain/fake colocated", () => {
  it("lists all plan §9.1 tools and loads fixture responses", () => {
    expect(BRAIN_TOOL_NAMES).toHaveLength(17);
    const fake = createBrainFake({ fixturesDir });
    for (const name of BRAIN_TOOL_NAMES) {
      const family = [
        "brain_browse",
        "brain_search",
        "brain_load",
        "brain_append_finding",
      ].includes(name)
        ? "knowledge"
        : [
              "brain_capture_batch",
              "brain_episode_checkpoint",
              "brain_private_search",
              "brain_private_load",
            ].includes(name)
          ? "private"
          : "coordination";
      const responsePath = path.join(fixturesDir, "tools", family, `${name}.response.json`);
      expect(fs.existsSync(responsePath)).toBe(true);
      if (
        name === "brain_browse" ||
        name === "brain_search" ||
        name === "brain_load" ||
        name === "brain_private_search" ||
        name === "brain_private_load" ||
        name === "brain_inbox_read"
      ) {
        const outcome = fake.callTool(name, {}, { authToken: "fake-valid-token" });
        expect(outcome.ok).toBe(true);
      }
    }
  });

  it("rejects Skills-shaped fields locally", () => {
    expect(
      validateBrainPayload({
        skillId: "skill_test_should_reject",
        telemetry: { event: "skills_run_start" },
      }),
    ).toMatchObject({ ok: false, code: "validation_error" });
  });
});

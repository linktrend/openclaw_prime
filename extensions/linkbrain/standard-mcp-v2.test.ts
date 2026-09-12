import { describe, expect, it } from "vitest";
import { createBrainFake } from "./fake/runtime.mjs";
import { LINKBRAIN_LEGACY_MCP_COMPATIBILITY_CONTRACT } from "./mcp-tool-filter.js";
import {
  isStandardBrainMcpOperation,
  isStandardBrainReadOperation,
  LINKBRAIN_V2_CONTENT_OPERATIONS,
  LINKBRAIN_V2_READ_OPERATIONS,
} from "./src/standard-mcp-v2.js";
import { BRAIN_V2_OPERATIONS } from "./src/v2-pins.js";

describe("Brain standard MCP v2 consumer", () => {
  it("maps progressive knowledge retrieval onto sessionless v2 operations", () => {
    expect(LINKBRAIN_V2_READ_OPERATIONS).toEqual([
      "v2.knowledge.browse",
      "v2.knowledge.search",
      "v2.knowledge.load",
    ]);
    expect(LINKBRAIN_V2_CONTENT_OPERATIONS).toContain("v2.knowledge.load");
    expect(isStandardBrainReadOperation("v2.knowledge.search")).toBe(true);
    expect(isStandardBrainReadOperation("brain_search")).toBe(false);
    expect(isStandardBrainMcpOperation("v2.projection.evidence")).toBe(true);
    expect(BRAIN_V2_OPERATIONS).toContain("v2.knowledge.load");
    expect(LINKBRAIN_LEGACY_MCP_COMPATIBILITY_CONTRACT.id).toBe("linkbrain.mcp-legacy/1.0");
  });

  it("serves v2 knowledge reads from the source fake without private payloads", () => {
    const fake = createBrainFake();
    const search = fake.callTool(
      "v2.knowledge.search",
      { query: "guide" },
      {
        authToken: "fake-valid-token",
      },
    );
    expect(search.ok).toBe(true);
    expect(JSON.stringify(search)).not.toMatch(/reasoning|accessToken|secret/i);
    const unknown = fake.callTool("v2.admin.wipe", {}, { authToken: "fake-valid-token" });
    expect(unknown.ok).toBe(false);
  });
});

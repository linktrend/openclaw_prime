import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LINKSKILLS_LEGACY_MCP_COMPATIBILITY_CONTRACT,
  LINKSKILLS_MCP_MANAGED_TOOL_ALLOWLIST,
  LINKSKILLS_MCP_TOOL_ALLOWLIST,
  LINKSKILLS_MCP_V2_TOOLS,
  assertAllowedLinkskillsMcpTool,
  buildLinkskillsMcpToolFilter,
  isAllowedLinkskillsMcpTool,
} from "./mcp-tool-filter.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const templatesDir = path.join(repoRoot, "docs/execution/openclawdevelopmentplan01/mcp-templates");

function readTemplate(name: string): {
  mcp: { servers: { linkskills: { enabled: boolean; toolFilter: { include: string[] } } } };
} {
  return JSON.parse(fs.readFileSync(path.join(templatesDir, name), "utf8")) as {
    mcp: { servers: { linkskills: { enabled: boolean; toolFilter: { include: string[] } } } };
  };
}

describe("linkskills managed MCP toolFilter (§9.2)", () => {
  it("allowlists exactly the frozen Skills tool families", () => {
    expect(LINKSKILLS_MCP_TOOL_ALLOWLIST).toEqual([
      "skills_list",
      "skills_search",
      "skills_describe",
      "skills_fragment_get",
      "skills_release_get",
      "skills_run_start",
      "skills_run_update",
      "skills_run_complete",
      "skills_run_fail",
      "skills_tool_resolve",
      "skills_tool_invoke",
      "skills_input_validate",
      "skills_output_validate",
      "skills_feedback_submit",
      "skills_trace_candidate_submit",
    ]);
    expect(buildLinkskillsMcpToolFilter().include).toEqual([...LINKSKILLS_MCP_TOOL_ALLOWLIST]);
  });

  it("default-denies unknown and Brain-domain tool names", () => {
    expect(isAllowedLinkskillsMcpTool("skills_list")).toBe(true);
    expect(isAllowedLinkskillsMcpTool("skills_unreviewed_admin")).toBe(false);
    expect(isAllowedLinkskillsMcpTool("brain_browse")).toBe(false);
    expect(() => assertAllowedLinkskillsMcpTool("brain_capture_batch")).toThrow(/default-deny/);
    expect(() => assertAllowedLinkskillsMcpTool("skills_mutate_catalog")).toThrow(/§9\.2/);
  });

  it("keeps legacy execution behind an explicit compatibility contract", () => {
    expect(LINKSKILLS_MCP_MANAGED_TOOL_ALLOWLIST).toEqual([...LINKSKILLS_MCP_V2_TOOLS]);
    expect(LINKSKILLS_MCP_MANAGED_TOOL_ALLOWLIST).not.toContain("skills_run_start");
    expect(LINKSKILLS_LEGACY_MCP_COMPATIBILITY_CONTRACT.id).toBe("linkskills.mcp-legacy/0.2");
    expect(LINKSKILLS_LEGACY_MCP_COMPATIBILITY_CONTRACT.removal).toMatch(/after all configured/);
  });

  it("parses Skills MCP templates with matching include lists and disabled servers", () => {
    for (const name of [
      "linkskills.stdio.fake.json",
      "linkskills.http.secretref.template.json",
      "linkskills.oauth.authprofile.template.json",
    ]) {
      const doc = readTemplate(name);
      expect(doc.mcp.servers.linkskills.enabled).toBe(false);
      expect(doc.mcp.servers.linkskills.toolFilter.include).toEqual([
        ...LINKSKILLS_MCP_TOOL_ALLOWLIST,
      ]);
      expect(JSON.stringify(doc)).not.toMatch(/sk-[a-zA-Z0-9]|Bearer [A-Za-z0-9._-]{20,}/);
    }
  });

  it("keeps SecretRef / authProfile placeholders as names only", () => {
    const http = fs.readFileSync(
      path.join(templatesDir, "linkskills.http.secretref.template.json"),
      "utf8",
    );
    const oauth = JSON.parse(
      fs.readFileSync(
        path.join(templatesDir, "linkskills.oauth.authprofile.template.json"),
        "utf8",
      ),
    ) as {
      mcp: { servers: { linkskills: { oauth: { authProfileId: string } } } };
    };
    expect(http).toContain("${LINKTREND_LINKSKILLS_STAGE_MCP_TOKEN}");
    expect(http).toContain("LINKTREND_LINKSKILLS_STAGE_PLUGIN_TOKEN");
    expect(oauth.mcp.servers.linkskills.oauth.authProfileId).toBe("linkskills-stage-mcp");
  });

  it("does not embed Brain MCP server keys in Skills templates", () => {
    for (const name of fs.readdirSync(templatesDir).filter((f) => f.startsWith("linkskills."))) {
      const text = fs.readFileSync(path.join(templatesDir, name), "utf8");
      expect(text).not.toContain('"linkbrain"');
      expect(text).not.toMatch(/brain_/);
    }
  });
});

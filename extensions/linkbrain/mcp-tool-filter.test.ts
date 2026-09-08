import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LINKBRAIN_MCP_MANAGED_TOOL_ALLOWLIST,
  LINKBRAIN_MCP_TOOL_ALLOWLIST,
  LINKBRAIN_MCP_V2_TOOLS,
  assertAllowedLinkbrainMcpTool,
  buildLinkbrainMcpToolFilter,
  isAllowedLinkbrainMcpTool,
} from "./mcp-tool-filter.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const templatesDir = path.join(repoRoot, "docs/execution/openclawdevelopmentplan01/mcp-templates");

function readTemplate(name: string): {
  mcp: { servers: { linkbrain: { enabled: boolean; toolFilter: { include: string[] } } } };
} {
  return JSON.parse(fs.readFileSync(path.join(templatesDir, name), "utf8")) as {
    mcp: { servers: { linkbrain: { enabled: boolean; toolFilter: { include: string[] } } } };
  };
}

describe("linkbrain managed MCP toolFilter (§9.1)", () => {
  it("allowlists exactly the frozen Brain tool families", () => {
    expect(LINKBRAIN_MCP_TOOL_ALLOWLIST).toEqual([
      "brain_browse",
      "brain_search",
      "brain_load",
      "brain_append_finding",
      "brain_capture_batch",
      "brain_episode_checkpoint",
      "brain_private_search",
      "brain_private_load",
      "brain_task_start",
      "brain_task_update",
      "brain_inbox_read",
      "brain_conflict_respond",
      "brain_message_send",
      "brain_checkpoint_write",
      "brain_handoff_create",
      "brain_handoff_accept",
      "brain_task_close",
    ]);
    expect(buildLinkbrainMcpToolFilter().include).toEqual([...LINKBRAIN_MCP_TOOL_ALLOWLIST]);
  });

  it("default-denies unknown and Skills-domain tool names", () => {
    expect(isAllowedLinkbrainMcpTool("brain_browse")).toBe(true);
    expect(isAllowedLinkbrainMcpTool("brain_unreviewed_admin")).toBe(false);
    expect(isAllowedLinkbrainMcpTool("skills_list")).toBe(false);
    expect(() => assertAllowedLinkbrainMcpTool("skills_run_start")).toThrow(/default-deny/);
    expect(() => assertAllowedLinkbrainMcpTool("brain_delete_everything")).toThrow(/§9\.1/);
  });

  it("keeps the standard v2 operations reachable alongside reviewed compatibility tools", () => {
    expect(LINKBRAIN_MCP_V2_TOOLS).toContain("v2.projection.evidence");
    expect(LINKBRAIN_MCP_MANAGED_TOOL_ALLOWLIST).toContain("v2.projection.evidence");
    expect(LINKBRAIN_MCP_MANAGED_TOOL_ALLOWLIST).toContain("brain_browse");
  });

  it("parses Brain MCP templates with matching include lists and disabled servers", () => {
    for (const name of [
      "linkbrain.stdio.fake.json",
      "linkbrain.http.secretref.template.json",
      "linkbrain.oauth.authprofile.template.json",
    ]) {
      const doc = readTemplate(name);
      expect(doc.mcp.servers.linkbrain.enabled).toBe(false);
      expect(doc.mcp.servers.linkbrain.toolFilter.include).toEqual([
        ...LINKBRAIN_MCP_TOOL_ALLOWLIST,
      ]);
      expect(JSON.stringify(doc)).not.toMatch(/sk-[a-zA-Z0-9]|Bearer [A-Za-z0-9._-]{20,}/);
    }
  });

  it("keeps SecretRef / authProfile placeholders as names only", () => {
    const http = fs.readFileSync(
      path.join(templatesDir, "linkbrain.http.secretref.template.json"),
      "utf8",
    );
    const oauth = JSON.parse(
      fs.readFileSync(path.join(templatesDir, "linkbrain.oauth.authprofile.template.json"), "utf8"),
    ) as {
      mcp: { servers: { linkbrain: { oauth: { authProfileId: string } } } };
    };
    expect(http).toContain("${LINKTREND_LINKBRAIN_STAGE_MCP_TOKEN}");
    expect(http).toContain("LINKTREND_LINKBRAIN_STAGE_INGESTION_TOKEN");
    expect(oauth.mcp.servers.linkbrain.oauth.authProfileId).toBe("linkbrain-stage-mcp");
  });

  it("does not embed Skills MCP server keys in Brain templates", () => {
    for (const name of fs.readdirSync(templatesDir).filter((f) => f.startsWith("linkbrain."))) {
      const text = fs.readFileSync(path.join(templatesDir, name), "utf8");
      expect(text).not.toContain('"linkskills"');
      expect(text).not.toMatch(/skills_/);
    }
  });
});

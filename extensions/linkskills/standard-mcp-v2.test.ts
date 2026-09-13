import { describe, expect, it } from "vitest";
import { LINKSKILLS_LEGACY_MCP_COMPATIBILITY_CONTRACT } from "./mcp-tool-filter.js";
import { parseLinkskillsConfig } from "./src/config.js";
import {
  isLegacySkillsExecutionOperation,
  isStandardSkillsMcpOperation,
  rejectNonStandardSkillsMcpOperation,
  SKILLS_STANDARD_MCP_OPERATIONS,
} from "./src/standard-mcp-v2.js";
import { callLinkskillsMcpTool } from "./src/transport.js";
import { SKILLS_V2_OPERATIONS } from "./src/v2.js";

describe("Skills standard MCP v2 consumer", () => {
  it("pins the sessionless v2 surface and fail-closes provider execution", () => {
    expect(SKILLS_STANDARD_MCP_OPERATIONS).toEqual([...SKILLS_V2_OPERATIONS]);
    expect(isStandardSkillsMcpOperation("skills_catalog_list")).toBe(true);
    expect(isStandardSkillsMcpOperation("skills_release_content_get")).toBe(true);
    expect(isLegacySkillsExecutionOperation("skills_tool_invoke")).toBe(true);
    expect(isLegacySkillsExecutionOperation("skills_run_start")).toBe(true);
    expect(rejectNonStandardSkillsMcpOperation("skills_tool_invoke")).toBe(
      "legacy_execution_disabled",
    );
    expect(LINKSKILLS_LEGACY_MCP_COMPATIBILITY_CONTRACT.id).toBe("linkskills.mcp-legacy/0.2");
  });

  it("fail-closes MCP consumer calls for leftover v1 execution names", async () => {
    const result = await callLinkskillsMcpTool({
      api: {
        config: {
          mcp: {
            servers: { linkskills: { enabled: true, url: "https://skills.example.test/mcp" } },
          },
        } as never,
        logger: {
          info: () => undefined,
          warn: () => undefined,
          error: () => undefined,
          debug: () => undefined,
        },
      },
      config: parseLinkskillsConfig({ transportMode: "mcp" }),
      toolName: "skills_tool_invoke",
      arguments: { tool_id: "published.echo" },
      createMcpSession: async () => ({
        callTool: async () => {
          throw new Error("must not open a provider execution session");
        },
        close: async () => undefined,
      }),
    });
    expect(result).toEqual({
      ok: false,
      safeMessage: "linkskills operation is not on the standard MCP v2 surface",
    });
  });
});

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.dirname(fileURLToPath(import.meta.url));

const FORBIDDEN_IMPORT =
  /from\s+["'](?:\.\.\/)+src\/|from\s+["']openclaw\/src\/|from\s+["']\.\.\/\.\.\/src\//;

const CONVERSATION_HOOK_PATTERNS = [
  /api\.on\(\s*["']message_/,
  /api\.on\(\s*["']before_prompt/,
  /api\.on\(\s*["']before_agent/,
  /api\.on\(\s*["']agent_end/,
  /api\.on\(\s*["']llm_input/,
  /api\.on\(\s*["']llm_output/,
  /api\.on\(\s*["']tool_result_persist/,
  /api\.on\(\s*["']session_/,
  /api\.on\(\s*["']compaction/,
  /allowConversationAccess/,
];

describe("linkskills plugin boundary", () => {
  it("production sources import only plugin-sdk or local barrels", () => {
    const files = [
      "index.ts",
      "api.ts",
      "runtime-api.ts",
      "src/config.ts",
      "src/envelopes.ts",
      "src/namespaces.ts",
      "src/runtime.ts",
      "src/stores.ts",
      "src/tools.ts",
      "src/transport.ts",
      "src/collect.ts",
      "src/bounded.ts",
      "src/drain-worker.ts",
      "src/feature-flags.ts",
      "src/opaque.ts",
      "src/auth-claims-1.1.ts",
    ];
    for (const relative of files) {
      const source = fs.readFileSync(path.join(root, relative), "utf8");
      expect(source, relative).not.toMatch(FORBIDDEN_IMPORT);
      expect(source, relative).not.toMatch(/plugin-sdk-internal/);
      expect(source, relative).not.toMatch(/from\s+["']\.\.\/\.\.\/extensions\//);
      expect(source, relative).not.toMatch(/extensions\/linkbrain/);
    }
  });

  it("registers zero conversation hooks (after_tool_call skills_* observation allowed)", () => {
    const index = fs.readFileSync(path.join(root, "index.ts"), "utf8");
    for (const pattern of CONVERSATION_HOOK_PATTERNS) {
      expect(index, String(pattern)).not.toMatch(pattern);
    }
    expect(index).toMatch(/after_tool_call/);
    expect(index).toMatch(/gateway_start/);
    expect(index).toMatch(/gateway_stop/);
    expect(index).toMatch(/LINKSKILLS_CONVERSATION_HOOK_POLICY/);
    expect(index).toMatch(/Never registers conversation/i);
  });
});

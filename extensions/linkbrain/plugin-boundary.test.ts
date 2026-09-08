import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LINKBRAIN_CONVERSATION_HOOKS, LINKBRAIN_REGISTERED_HOOKS } from "./src/lifecycle.js";

const root = path.dirname(fileURLToPath(import.meta.url));

const FORBIDDEN_IMPORT =
  /from\s+["'](?:\.\.\/)+src\/|from\s+["']openclaw\/src\/|from\s+["']\.\.\/\.\.\/src\//;

describe("linkbrain plugin boundary", () => {
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
      "src/capture.ts",
      "src/lifecycle.ts",
      "src/opaque.ts",
      "src/sanitize.ts",
      "src/tools.ts",
      "src/transport.ts",
      "src/bounded.ts",
      "src/drain-worker.ts",
      "src/feature-flags.ts",
      "src/auth-claims-1.1.ts",
      "src/oauth-tool.ts",
    ];
    for (const relative of files) {
      const source = fs.readFileSync(path.join(root, relative), "utf8");
      expect(source, relative).not.toMatch(FORBIDDEN_IMPORT);
      expect(source, relative).not.toMatch(/plugin-sdk-internal/);
      expect(source, relative).not.toMatch(/from\s+["']\.\.\/\.\.\/extensions\//);
    }
  });

  it("registers §10.1 lifecycle hooks and documents conversation access", () => {
    const index = fs.readFileSync(path.join(root, "index.ts"), "utf8");
    expect(index).toContain("allowConversationAccess");
    expect(index).toContain("isLinkbrainConversationAccessAllowed");
    for (const hook of LINKBRAIN_REGISTERED_HOOKS) {
      expect(index, hook).toContain(`"${hook}"`);
    }
    expect([...LINKBRAIN_CONVERSATION_HOOKS]).toEqual(
      expect.arrayContaining(["message_received", "agent_end", "session_start", "before_reset"]),
    );
    expect(LINKBRAIN_CONVERSATION_HOOKS).not.toContain("gateway_start");
    expect(LINKBRAIN_CONVERSATION_HOOKS).not.toContain("gateway_stop");
    expect(index).not.toMatch(/api\.on\(\s*["']before_prompt/);
    expect(index).not.toMatch(/api\.on\(\s*["']llm_input/);
  });
});

#!/usr/bin/env node
/**
 * Process-isolated Skills fake entrypoint.
 *
 * Modes:
 *   node cli.mjs http     — ephemeral 127.0.0.1 HTTP (prints JSON {baseUrl,port} then serves)
 *   node cli.mjs stdio    — stdio MCP JSON-RPC (one JSON object per line)
 *
 * State is in-memory only and dies with the process.
 */
import { startSkillsFakeHttp } from "./http-server.mjs";
import { SkillsFakeService } from "./service.mjs";
import { createStdioMcpLoop } from "./stdio-mcp.mjs";

const mode = process.argv[2] ?? "http";

if (mode === "http") {
  // Empty/unset env must not become 0 via Number("") — that rate-limits the first request.
  const rawThrottle = process.env.LINKSKILLS_FAKE_THROTTLE_AFTER;
  const parsedThrottle =
    rawThrottle != null && rawThrottle.trim() !== "" ? Number(rawThrottle) : Number.NaN;
  const service = new SkillsFakeService({
    throttleAfter: Number.isFinite(parsedThrottle) ? parsedThrottle : undefined,
  });
  const handle = await startSkillsFakeHttp({ service });
  process.stdout.write(
    `${JSON.stringify({
      baseUrl: handle.baseUrl,
      port: handle.port,
      pid: process.pid,
      mode: "http",
      limitation: "in_memory",
    })}\n`,
  );
  const shutdown = async () => {
    await handle.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} else if (mode === "stdio") {
  void createStdioMcpLoop();
} else {
  process.stderr.write(`Unknown mode: ${mode}\n`);
  process.exit(2);
}

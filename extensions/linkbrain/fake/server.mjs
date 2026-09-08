#!/usr/bin/env node
/**
 * Process/port-isolated Brain fake MCP/HTTP server.
 *
 * Usage:
 *   node extensions/linkbrain/fake/server.mjs --stdio
 *   node extensions/linkbrain/fake/server.mjs --http
 *
 * HTTP binds 127.0.0.1 on an ephemeral port and prints:
 *   BRAIN_FAKE_URL=http://127.0.0.1:<port>
 *
 * Phase 1 limitation: idempotency is in-memory only; restart clears replay map.
 */
import http from "node:http";
import process from "node:process";
import { createBrainFake, handleBrainMcpMessage, BRAIN_CONTRACT_VERSION } from "./runtime.mjs";

function parseArgs(argv) {
  const mode = argv.includes("--stdio") ? "stdio" : "http";
  const fixturesIdx = argv.indexOf("--fixtures-dir");
  const fixturesDir = fixturesIdx >= 0 ? argv[fixturesIdx + 1] : undefined;
  return { mode, fixturesDir };
}

function sendStdio(message) {
  if (!message) {
    return;
  }
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function runStdio(fake) {
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          sendStdio({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: "Parse error" },
          });
          newline = buffer.indexOf("\n");
          continue;
        }
        sendStdio(handleBrainMcpMessage(fake, message));
      }
      newline = buffer.indexOf("\n");
    }
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function runHttp(fake) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, fake.health());
        return;
      }
      if (req.method === "POST" && url.pathname === "/version") {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const negotiated = fake.negotiateVersion(body.requested ?? body.contractVersion);
        sendJson(res, negotiated.ok ? 200 : 409, negotiated);
        return;
      }
      if (req.method === "GET" && url.pathname === "/mcp/tools") {
        sendJson(res, 200, { tools: fake.listTools() });
        return;
      }
      if (req.method === "POST" && url.pathname === "/mcp") {
        const raw = await readBody(req);
        const message = raw ? JSON.parse(raw) : {};
        const response = handleBrainMcpMessage(fake, message);
        sendJson(res, 200, response ?? { jsonrpc: "2.0", result: null });
        return;
      }
      if (req.method === "POST" && url.pathname === "/tools/call") {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const authHeader = req.headers.authorization;
        const authToken =
          body.authToken ??
          (typeof authHeader === "string" && authHeader.startsWith("Bearer ")
            ? authHeader.slice("Bearer ".length)
            : undefined);
        const outcome = fake.callTool(body.name, body.arguments ?? {}, {
          authToken,
          requestId: body.requestId,
        });
        sendJson(res, outcome.ok ? 200 : 400, outcome);
        return;
      }
      sendJson(res, 404, { error: { code: "not_found", safeMessage: "Unknown route." } });
    } catch (error) {
      sendJson(res, 500, {
        error: {
          code: "internal_error",
          message: "Brain fake request failed.",
          safeMessage: "The Gateway could not complete this request.",
          retryable: true,
          detail: error instanceof Error ? error.message : "unknown",
        },
      });
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    // Ephemeral port, loopback only — process/port isolation for tests.
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind Brain fake HTTP server");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  process.stdout.write(`BRAIN_FAKE_URL=${baseUrl}\n`);
  process.stdout.write(`BRAIN_FAKE_CONTRACT=${BRAIN_CONTRACT_VERSION}\n`);
  process.stdout.write(
    "BRAIN_FAKE_NOTE=idempotency_map_is_in_memory_only_restart_clears_replay_state\n",
  );

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  return server;
}

const { mode, fixturesDir } = parseArgs(process.argv.slice(2));
const fake = createBrainFake({ fixturesDir });

if (mode === "stdio") {
  await runStdio(fake);
} else {
  await runHttp(fake);
}

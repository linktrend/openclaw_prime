import { OPERATIONS } from "./constants.mjs";
import { SkillsFakeService } from "./service.mjs";

/**
 * @param {unknown} value
 * @param {string} [fallback]
 */
function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "linkskills-fake-mcp";
const SERVER_VERSION = "0.1.0";

/**
 * Minimal stdio JSON-RPC MCP facade over SkillsFakeService.
 * One JSON message per line on stdin/stdout.
 *
 * @param {{ service?: SkillsFakeService; input?: NodeJS.ReadableStream; output?: NodeJS.WritableStream }} [opts]
 */
export function createStdioMcpLoop(opts = {}) {
  const service = opts.service ?? new SkillsFakeService();
  const input = opts.input ?? process.stdin;
  const output = opts.output ?? process.stdout;
  let buffer = "";

  const write = (message) => {
    output.write(`${JSON.stringify(message)}\n`);
  };

  const onLine = (line) => {
    if (!line.trim()) {
      return;
    }
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      write({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      });
      return;
    }
    const response = handleRpc(service, message);
    if (response) {
      write(response);
    }
  };

  const onData = (chunk) => {
    buffer += chunk.toString("utf8");
    let idx;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      onLine(line);
    }
  };

  input.on("data", onData);
  return {
    service,
    stop() {
      input.off("data", onData);
    },
  };
}

/**
 * @param {SkillsFakeService} service
 * @param {Record<string, unknown>} message
 */
export function handleRpc(service, message) {
  const method = message.method;
  const id = message.id ?? null;
  const params = /** @type {Record<string, unknown>} */ (message.params ?? {});

  if (method === "notifications/initialized" || method === "initialized") {
    return null;
  }

  if (id === null || id === undefined) {
    return null;
  }

  try {
    if (method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        },
      };
    }
    if (method === "tools/list") {
      return { jsonrpc: "2.0", id, result: { tools: service.listTools() } };
    }
    if (method === "tools/call") {
      const name = asString(params.name);
      const args = /** @type {Record<string, unknown>} */ (params.arguments ?? {});
      if (!OPERATIONS.includes(name)) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Unknown tool: ${name}` },
        };
      }
      try {
        const result = service.dispatch(name, args, {
          authorization: /** @type {string|undefined} */ (args.authorization),
        });
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(result) }],
            structuredContent: result,
          },
        };
      } catch (err) {
        const envelope = service.toErrorEnvelope(err);
        delete envelope.httpStatus;
        return {
          jsonrpc: "2.0",
          id,
          result: {
            isError: true,
            content: [{ type: "text", text: JSON.stringify(envelope) }],
            structuredContent: envelope,
          },
        };
      }
    }
    if (method === "ping") {
      return { jsonrpc: "2.0", id, result: {} };
    }
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${String(method)}` },
    };
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: err instanceof Error ? err.message : "Internal error",
      },
    };
  }
}

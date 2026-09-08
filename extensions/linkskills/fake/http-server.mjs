import http from "node:http";
import { OPERATIONS } from "./constants.mjs";
import { SkillsFakeService } from "./service.mjs";

/**
 * Start an ephemeral 127.0.0.1 HTTP Skills fake.
 * Port 0 binds an OS-assigned free port (process/port isolated).
 *
 * @param {{ service?: SkillsFakeService; host?: string }} [opts]
 */
export async function startSkillsFakeHttp(opts = {}) {
  const service = opts.service ?? new SkillsFakeService();
  const host = opts.host ?? "127.0.0.1";

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${host}`);
      const body = await readJsonBody(req);

      if (req.method === "GET" && url.pathname === "/health") {
        return sendJson(res, 200, service.health());
      }
      if (req.method === "POST" && url.pathname === "/v1/version/negotiate") {
        return sendJson(res, 200, service.negotiateVersion(body));
      }
      if (req.method === "GET" && url.pathname === "/v1/tools") {
        return sendJson(res, 200, { tools: service.listTools() });
      }

      const opMatch = url.pathname.match(/^\/v1\/(skills_[a-z_]+)$/u);
      if (req.method === "POST" && opMatch) {
        const operation = opMatch[1];
        if (!OPERATIONS.includes(operation)) {
          return sendJson(res, 404, {
            code: "not_found",
            message: `Unknown operation ${operation}`,
          });
        }
        try {
          const result = service.dispatch(operation, body, {
            authorization: header(req, "authorization") ?? body.authorization,
          });
          return sendJson(res, 200, result);
        } catch (err) {
          const envelope = service.toErrorEnvelope(err);
          const status = envelope.httpStatus ?? 400;
          delete envelope.httpStatus;
          return sendJson(res, status, envelope);
        }
      }

      sendJson(res, 404, { code: "not_found", message: "Unknown route" });
    } catch (err) {
      sendJson(res, 500, {
        code: "internal_error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => resolve(undefined));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("failed to bind ephemeral Skills fake port");
  }

  const baseUrl = `http://${host}:${address.port}`;
  return {
    service,
    server,
    host,
    port: address.port,
    baseUrl,
    async stop() {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err instanceof Error ? err : new Error("Skills fake HTTP server close failed"));
            return;
          }
          resolve(undefined);
        });
      });
    },
  };
}

/**
 * @param {import("node:http").IncomingMessage} req
 */
function header(req, name) {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * @param {import("node:http").IncomingMessage} req
 */
async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) {
    return {};
  }
  return JSON.parse(raw);
}

/**
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

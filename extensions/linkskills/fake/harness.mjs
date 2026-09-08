/**
 * Process/port isolation harness for the Skills fake.
 * Kept inside the extension package so extension tests do not import repo test helpers.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mintFakeToken } from "./auth.mjs";
import { startSkillsFakeHttp } from "./http-server.mjs";
import { SkillsFakeService } from "./service.mjs";

const fakeCliPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "cli.mjs");

/**
 * Valid sanitized claim used by Skills fake integration tests.
 * @param {Record<string, unknown>} [overrides]
 * @returns {Record<string, unknown>}
 */
export function fixtureSkillsClaim(overrides = {}) {
  return {
    actor_id: "actor:fixture-lisa-01",
    actor_kind: "openclaw_agent",
    org_id: "org:fixture-studio-01",
    scopes: ["skills:read", "skills:write"],
    audience: "linkskills",
    exp: 1893456000,
    credential_id: "cred:fixture-skills-01",
    ...overrides,
  };
}

/**
 * Start Skills fake in-process on an ephemeral 127.0.0.1 port.
 * @param {{ throttleAfter?: number }} [opts]
 */
export async function startInProcessSkillsFake(opts = {}) {
  const service = new SkillsFakeService({
    throttleAfter: opts.throttleAfter,
  });
  const http = await startSkillsFakeHttp({ service });
  return wrapHttpHandle({
    mode: "in-process",
    port: http.port,
    service: http.service,
    stop: () => http.stop(),
  });
}

/**
 * Spawn a process-isolated Skills fake HTTP child (cli.mjs http).
 * @param {{ throttleAfter?: number }} [opts]
 */
export async function startChildProcessSkillsFake(opts = {}) {
  const env = { ...process.env };
  if (opts.throttleAfter != null) {
    env.LINKSKILLS_FAKE_THROTTLE_AFTER = String(opts.throttleAfter);
  }

  const child = spawn(process.execPath, [fakeCliPath, "http"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const startup = await readStartupLine(child);
  const port = Number(startup.port);
  assertPositiveIntegerPort(port);

  let stopped = false;
  const stop = async () => {
    if (stopped) {
      return;
    }
    stopped = true;
    child.removeAllListeners("exit");
    if (!child.killed) {
      child.kill("SIGTERM");
    }
    await new Promise((resolve) => {
      const done = () => resolve(undefined);
      child.once("exit", done);
      setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
        done();
      }, 2000).unref?.();
    });
  };

  return wrapHttpHandle({
    mode: "child-process",
    port,
    pid: child.pid,
    stop,
  });
}

export { mintFakeToken };

/**
 * Reconstruct a loopback base URL from a validated numeric port only.
 * Callers must never pass a config/opts-shaped baseUrl into fetch.
 * @param {number} port
 * @returns {string}
 */
function loopbackBaseUrl(port) {
  assertPositiveIntegerPort(port);
  return `http://127.0.0.1:${port}`;
}

/**
 * @param {number} port
 */
function assertPositiveIntegerPort(port) {
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Skills fake invalid port: ${String(port)}`);
  }
}

/**
 * @param {{
 *   mode: "in-process" | "child-process";
 *   port: number;
 *   pid?: number;
 *   service?: SkillsFakeService;
 *   stop: () => Promise<void>;
 * }} input
 */
function wrapHttpHandle(input) {
  const baseUrl = loopbackBaseUrl(input.port);
  const invoke = async (operation, body = {}, opts = {}) => {
    const response = await fetch(`${baseUrl}/v1/${operation}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(opts.authorization ? { authorization: opts.authorization } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    return { status: response.status, body: json };
  };

  return {
    mode: input.mode,
    baseUrl,
    port: input.port,
    pid: input.pid,
    service: input.service,
    stop: input.stop,
    invoke,
    async health() {
      const response = await fetch(`${baseUrl}/health`);
      return await response.json();
    },
    async negotiateVersion(body) {
      const response = await fetch(`${baseUrl}/v1/version/negotiate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return await response.json();
    },
  };
}

/**
 * @param {import("node:child_process").ChildProcess} child
 * @returns {Promise<Record<string, unknown>>}
 */
async function readStartupLine(child) {
  return await new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error(`Skills fake child startup timeout. stderr=${stderr}`));
      child.kill("SIGKILL");
    }, 10_000);

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
      const nl = stdout.indexOf("\n");
      if (nl >= 0 && !settled) {
        settled = true;
        clearTimeout(timer);
        try {
          resolve(JSON.parse(stdout.slice(0, nl)));
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      }
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(err instanceof Error ? err : new Error(String(err)));
    });
    child.on("exit", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Skills fake child exited early code=${code} stderr=${stderr}`));
    });
  });
}

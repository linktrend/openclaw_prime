/**
 * Shared Brain-only fake entry for OpenClaw tests.
 *
 * Loads the Phase 1 linkbrain fake runtime by path until the bundled plugin
 * exposes a public test surface in Phase 2. Brain-only symbols; no Skills.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const helperDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(helperDir, "../../..");
const runtimePath = path.join(repoRoot, "extensions/linkbrain/fake/runtime.mjs");
const serverPath = path.join(repoRoot, "extensions/linkbrain/fake/server.mjs");

type BrainFakeInstance = {
  fixturesDir: string;
  contractVersion: string;
  listTools: () => Array<{ name: string; description: string; inputSchema: unknown }>;
  callTool: (
    toolName: string,
    args?: Record<string, unknown>,
    meta?: { authToken?: string; requestId?: string },
  ) => Record<string, unknown> & {
    ok: boolean;
    replayed?: boolean;
    result?: Record<string, unknown>;
    error?: Record<string, unknown>;
  };
  health: () => Record<string, unknown>;
  negotiateVersion: (requested?: string) => Record<string, unknown> & {
    ok: boolean;
    compatible?: boolean;
  };
  getIdempotencySize: () => number;
  clearIdempotency: () => void;
  setForceFailure: (kind: string | null) => void;
  setThrottleAfter: (count: number | null) => void;
};

type BrainFakeRuntime = {
  BRAIN_CONTRACT_VERSION: string;
  BRAIN_TOOL_NAMES: readonly string[];
  createBrainFake: (options?: {
    fixturesDir?: string;
    now?: () => string;
    throttleAfter?: number;
    forceFailure?: string | null;
  }) => BrainFakeInstance;
  validateBrainPayload: (payload: unknown) => {
    ok: boolean;
    code?: string;
    fields?: string[];
    safeMessage?: string;
  };
  handleBrainMcpMessage: (
    fake: BrainFakeInstance,
    message: unknown,
  ) => {
    jsonrpc: "2.0";
    id?: unknown;
    result?: {
      tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>;
      [key: string]: unknown;
    };
    error?: Record<string, unknown>;
  } | null;
  listBrainTools: () => Array<{ name: string; description: string; inputSchema: unknown }>;
};

let runtimePromise: Promise<BrainFakeRuntime> | null = null;

function loadRuntime(): Promise<BrainFakeRuntime> {
  if (!runtimePromise) {
    runtimePromise = import(pathToFileURL(runtimePath).href) as Promise<BrainFakeRuntime>;
  }
  return runtimePromise;
}

export async function getBrainToolNames(): Promise<readonly string[]> {
  const runtime = await loadRuntime();
  return runtime.BRAIN_TOOL_NAMES;
}

export async function createBrainFake(
  options?: Parameters<BrainFakeRuntime["createBrainFake"]>[0],
): Promise<BrainFakeInstance> {
  const runtime = await loadRuntime();
  return runtime.createBrainFake(options);
}

export async function validateBrainPayload(
  payload: unknown,
): Promise<ReturnType<BrainFakeRuntime["validateBrainPayload"]>> {
  const runtime = await loadRuntime();
  return runtime.validateBrainPayload(payload);
}

export async function handleBrainMcpMessage(
  fake: BrainFakeInstance,
  message: unknown,
): Promise<ReturnType<BrainFakeRuntime["handleBrainMcpMessage"]>> {
  const runtime = await loadRuntime();
  return runtime.handleBrainMcpMessage(fake, message);
}

export type BrainFakeHttpServer = {
  baseUrl: string;
  pid?: number;
  stop: () => Promise<void>;
};

/**
 * Start a process/port-isolated Brain fake HTTP server on 127.0.0.1:<ephemeral>.
 * Caller must stop() to terminate the child process.
 */
export async function startBrainFakeHttpServer(
  options: {
    fixturesDir?: string;
    timeoutMs?: number;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<BrainFakeHttpServer> {
  const args = [serverPath, "--http"];
  if (options.fixturesDir) {
    args.push("--fixtures-dir", options.fixturesDir);
  }
  const child = spawn(process.execPath, args, {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...options.env },
  });

  const baseUrl = await new Promise<string>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Brain fake HTTP server did not publish URL.\n${stderr || stdout}`));
    }, options.timeoutMs ?? 10_000);

    const onData = (chunk: Buffer | string) => {
      stdout += chunk.toString("utf8");
      const match = stdout.match(/^BRAIN_FAKE_URL=(http:\/\/127\.0\.0\.1:\d+)\s*$/m);
      if (match?.[1]) {
        clearTimeout(timer);
        child.stdout?.off("data", onData);
        child.off("exit", onExit);
        resolve(match[1]);
      }
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      clearTimeout(timer);
      reject(new Error(`Brain fake exited early code=${code} signal=${signal}\n${stderr}`));
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString("utf8");
    });
    child.once("exit", onExit);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

  return {
    baseUrl,
    pid: child.pid,
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) {
        return;
      }
      await new Promise<void>((resolve) => {
        child.once("exit", () => resolve());
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) {
            child.kill("SIGKILL");
          }
        }, 2000);
      });
    },
  };
}

export const BRAIN_FAKE_PHASE1_LIMITATION =
  "Idempotency map is in-memory only; fake process restart clears replay state.";

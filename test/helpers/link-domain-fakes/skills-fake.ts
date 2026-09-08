/**
 * Shared Skills-only fake entry for OpenClaw tests.
 *
 * Claim/token helpers stay local and sync. HTTP/service start paths load the
 * extension fake harness dynamically so test/helpers never statically import
 * bundled plugin files (boundary inventory rule).
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const helperDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(helperDir, "../../..");
const harnessPath = path.join(repoRoot, "extensions/linkskills/fake/harness.mjs");

type SkillsFakeServiceInstance = {
  dispatch: (
    operation: string,
    body: Record<string, unknown>,
    opts?: { authorization?: string },
  ) => Record<string, unknown>;
  health: () => Record<string, unknown>;
  negotiateVersion: (body: Record<string, unknown>) => Record<string, unknown>;
  listTools: () => unknown[];
  toErrorEnvelope: (err: unknown) => Record<string, unknown> & { httpStatus?: number };
};

type SkillsFakeHarness = {
  startChildProcessSkillsFake: (opts?: { throttleAfter?: number }) => Promise<SkillsFakeHandle>;
};

export type SkillsFakeHandle = {
  mode: "in-process" | "child-process";
  baseUrl: string;
  port: number;
  pid?: number;
  service?: SkillsFakeServiceInstance;
  stop: () => Promise<void>;
  invoke: (
    operation: string,
    body?: Record<string, unknown>,
    opts?: { authorization?: string },
  ) => Promise<{ status: number; body: Record<string, unknown> }>;
  health: () => Promise<Record<string, unknown>>;
  negotiateVersion: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

let harnessPromise: Promise<SkillsFakeHarness> | null = null;

function loadHarness(): Promise<SkillsFakeHarness> {
  if (!harnessPromise) {
    harnessPromise = import(pathToFileURL(harnessPath).href) as Promise<SkillsFakeHarness>;
  }
  return harnessPromise;
}

/**
 * Mint a deterministic fake bearer token for tests.
 * Mirrors extensions/linkskills/fake/auth.mjs without a static extension import.
 */
export function mintFakeToken(claims: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return `fake.${payload}`;
}

/**
 * Valid sanitized claim used by Skills fake integration tests.
 */
export function fixtureSkillsClaim(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
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
 * Spawn a process-isolated Skills fake HTTP child (cli.mjs http).
 */
export async function startChildProcessSkillsFake(opts?: {
  throttleAfter?: number;
}): Promise<SkillsFakeHandle> {
  const harness = await loadHarness();
  return harness.startChildProcessSkillsFake(opts);
}

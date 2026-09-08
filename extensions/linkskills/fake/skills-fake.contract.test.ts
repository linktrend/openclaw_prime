import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { mintFakeToken } from "./auth.mjs";
import { OPERATIONS } from "./constants.mjs";
import {
  fixtureSkillsClaim,
  startChildProcessSkillsFake,
  startInProcessSkillsFake,
} from "./harness.mjs";
import { findProhibitedField } from "./prohibited.mjs";
import { SkillsFakeService } from "./service.mjs";
import { handleRpc } from "./stdio-mcp.mjs";

type SkillsFakeHandle = Awaited<ReturnType<typeof startInProcessSkillsFake>>;

const fixturesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(fixturesRoot, rel), "utf8")) as Record<
    string,
    unknown
  >;
}

describe("linkskills fixtures parse", () => {
  it("covers every §9.2 tool with request/response/error", () => {
    for (const op of OPERATIONS) {
      for (const kind of ["request", "response", "error"] as const) {
        const file = path.join(fixturesRoot, "tools", op, `${kind}.json`);
        expect(fs.existsSync(file), file).toBe(true);
        expect(() => JSON.parse(fs.readFileSync(file, "utf8"))).not.toThrow();
      }
    }
  });

  it("parses identity, auth, telemetry, failures, health, replay, prohibited sets", () => {
    const files = [
      "identity/positive-claim.json",
      "identity/negative-claim.json",
      "auth/expired.json",
      "auth/revoked.json",
      "auth/wrong-audience.json",
      "auth/wrong-scope.json",
      "telemetry/structured-event.json",
      "telemetry/validation-outcome-pass.json",
      "telemetry/validation-outcome-fail.json",
      "failures/retryable.json",
      "failures/terminal.json",
      "failures/throttled.json",
      "failures/authentication.json",
      "health/health-ok.json",
      "health/version-negotiation.json",
      "replay/duplicate-idempotency.json",
      "replay/replay-response.json",
      "prohibited/conversation.json",
      "prohibited/message-body.json",
      "prohibited/prompt.json",
      "prohibited/reasoning.json",
      "prohibited/brain-findings.json",
      "prohibited/raw-tool-args.json",
      "prohibited/raw-tool-results.json",
    ];
    for (const rel of files) {
      const json = readJson(rel);
      expect(json).toBeTypeOf("object");
    }
  });

  it("keeps structured telemetry free of conversation/content fields", () => {
    const event = readJson("telemetry/structured-event.json");
    expect(findProhibitedField(event)).toBeNull();
  });
});

describe("linkskills fake contract", () => {
  const handles: SkillsFakeHandle[] = [];

  afterEach(async () => {
    while (handles.length > 0) {
      const handle = handles.pop();
      await handle?.stop();
    }
  });

  it("rejects prohibited conversation/content fields", async () => {
    const handle = await startInProcessSkillsFake();
    handles.push(handle);
    const auth = `Bearer ${mintFakeToken(fixtureSkillsClaim())}`;
    const prohibited = readJson("prohibited/conversation.json");
    const request = prohibited.request as Record<string, unknown>;
    const result = await handle.invoke("skills_run_update", request, { authorization: auth });
    expect(result.status).toBe(400);
    expect(result.body.code).toBe("validation_failed");
    expect(JSON.stringify(result.body)).toContain("conversation");
  });

  it("rejects Brain-shaped fields on Skills fake", async () => {
    const handle = await startInProcessSkillsFake();
    handles.push(handle);
    const auth = `Bearer ${mintFakeToken(fixtureSkillsClaim())}`;
    const prohibited = readJson("prohibited/brain-findings.json");
    const request = prohibited.request as Record<string, unknown>;
    const result = await handle.invoke("skills_run_update", request, { authorization: auth });
    expect(result.status).toBe(400);
    expect(result.body.code).toBe("validation_failed");
    expect(String(result.body.message)).toMatch(/brain_/i);
  });

  it("replays duplicate idempotency keys", async () => {
    const handle = await startInProcessSkillsFake();
    handles.push(handle);
    const auth = `Bearer ${mintFakeToken(fixtureSkillsClaim())}`;
    const req = readJson("tools/skills_run_start/request.json");
    const first = await handle.invoke("skills_run_start", req, { authorization: auth });
    const second = await handle.invoke("skills_run_start", req, { authorization: auth });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const firstData = first.body.data as Record<string, unknown>;
    const secondData = second.body.data as Record<string, unknown>;
    expect(secondData.run_id).toBe(firstData.run_id);
    expect(secondData.replayed).toBe(true);
  });

  it("auth subset: expired / revoked / wrong-audience / wrong-scope", async () => {
    const handle = await startInProcessSkillsFake();
    handles.push(handle);

    const expired = fixtureSkillsClaim({ exp: 1_700_000_000 });
    const revoked = fixtureSkillsClaim({ credential_id: "cred:fixture-revoked-01" });
    const wrongAudience = fixtureSkillsClaim({ audience: "linkbrain" });
    const wrongScope = fixtureSkillsClaim({ scopes: ["brain:read"] });

    for (const [claim, expectedAuth] of [
      [expired, "auth_expired"],
      [revoked, "auth_revoked"],
      [wrongAudience, "auth_wrong_audience"],
      [wrongScope, "auth_forbidden"],
    ] as const) {
      const result = await handle.invoke(
        "skills_list",
        { params: {}, request_id: "req:auth" },
        { authorization: `Bearer ${mintFakeToken(claim)}` },
      );
      expect([401, 403]).toContain(result.status);
      const details = result.body.details as Record<string, unknown>;
      expect(details.auth_code).toBe(expectedAuth);
    }
  });

  it("serves health and version negotiation", async () => {
    const handle = await startInProcessSkillsFake();
    handles.push(handle);
    const health = await handle.health();
    expect(health.status).toBe("ok");
    expect(health.mode).toBe("in_memory");
    expect(String(health.limitation)).toMatch(/in-memory/i);

    const ok = await handle.negotiateVersion({
      client_contract_version: "0.1",
      client_api_version: "skills.api.v0.1",
    });
    expect(ok.status).toBe("compatible");

    const bad = await handle.negotiateVersion({
      client_contract_version: "9.9",
      client_api_version: "skills.api.v9.9",
    });
    expect(bad.status).toBe("incompatible");
  });

  it("starts a process/port-isolated child fake", async () => {
    const handle = await startChildProcessSkillsFake();
    handles.push(handle);
    expect(handle.mode).toBe("child-process");
    expect(handle.port).toBeGreaterThan(0);
    expect(handle.pid).toBeGreaterThan(0);
    const health = await handle.health();
    expect(health.status).toBe("ok");
  });

  it("stdio MCP tools/call returns structured content", () => {
    const service = new SkillsFakeService();
    const auth = `Bearer ${mintFakeToken(fixtureSkillsClaim())}`;
    const response = handleRpc(service, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "skills_list",
        arguments: { params: { usable_only: true }, authorization: auth },
      },
    });
    expect(response?.result).toBeTruthy();
    const result = response?.result as { structuredContent: Record<string, unknown> } | undefined;
    expect(result?.structuredContent.contract_version).toBe("0.1");
  });
});

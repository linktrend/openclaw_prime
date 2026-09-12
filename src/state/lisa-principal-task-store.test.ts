import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LISA_PRINCIPAL_TASKS_TABLE } from "./lisa-principal-task-schema.js";
import {
  enqueueLisaPrincipalPending,
  getLisaPrincipalTaskByDisplayRef,
  intakeLisaPrincipalTask,
  mapLisaPrincipalPending,
  mergeLisaPrincipalTasks,
  setLisaPrincipalProgramRef,
  transitionLisaPrincipalTask,
  type LisaPrincipalTaskStoreOptions,
} from "./lisa-principal-task-store.js";
import { OPENCLAW_AGENT_SCHEMA_VERSION } from "./openclaw-agent-db-contract.js";
import {
  closeOpenClawAgentDatabasesForTest,
  openOpenClawAgentDatabase,
} from "./openclaw-agent-db.js";

const dirs: string[] = [];

afterEach(() => {
  closeOpenClawAgentDatabasesForTest();
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function storeOptions(): LisaPrincipalTaskStoreOptions {
  const dir = mkdtempSync(join(tmpdir(), "lisa-principal-"));
  dirs.push(dir);
  return { agentId: "lisa", path: join(dir, "agent.sqlite") };
}

describe("Lisa Principal-task ledger", () => {
  it("assigns a collision-resistant internal id and T-000001 on first intake", () => {
    const options = storeOptions();
    const first = intakeLisaPrincipalTask(options, {
      title: "Review launch plan",
      explicit: true,
      nowMs: 100,
    });
    expect(first.created).toBe(true);
    expect(first.task.displayRef).toBe("T-000001");
    expect(first.task.internalId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(first.task.status).toBe("confirmed_ready");
    expect(first.task.ledger).toBe("google_tasks");
    const inferred = intakeLisaPrincipalTask(options, {
      title: "Maybe useful",
      explicit: false,
      nowMs: 101,
    });
    expect(inferred.task.displayRef).toBe("T-000002");
    expect(inferred.task.status).toBe("provisional");
    expect(inferred.task.internalId).not.toBe(first.task.internalId);
  });

  it("keeps one T-ID across channels and related-key duplicates", () => {
    const options = storeOptions();
    const telegram = intakeLisaPrincipalTask(options, {
      title: "One logical task",
      explicit: true,
      relatedKey: "launch",
      channel: { kind: "telegram", value: "tg-1" },
      nowMs: 1,
    });
    const email = intakeLisaPrincipalTask(options, {
      title: "One logical task again",
      explicit: true,
      relatedKey: "launch",
      channel: { kind: "email", value: "mail-1" },
      nowMs: 2,
    });
    expect(email.created).toBe(false);
    expect(email.task.displayRef).toBe(telegram.task.displayRef);
    const replay = intakeLisaPrincipalTask(options, {
      title: "ignored",
      explicit: true,
      channel: { kind: "telegram", value: "tg-1" },
      nowMs: 3,
    });
    expect(replay.task.internalId).toBe(telegram.task.internalId);
    const second = intakeLisaPrincipalTask(options, {
      title: "Other work",
      explicit: true,
      nowMs: 4,
    });
    const merged = mergeLisaPrincipalTasks(options, {
      canonicalInternalId: telegram.task.internalId,
      duplicateInternalId: second.task.internalId,
      nowMs: 5,
    });
    expect(merged.displayRef).toBe("T-000001");
  });

  it("keeps Google Tasks for Carlos and HOLD for other owners, with immutable program refs", () => {
    const options = storeOptions();
    const hold = intakeLisaPrincipalTask(options, {
      title: "Lisa research",
      explicit: true,
      owner: "Lisa",
      nowMs: 1,
    });
    expect(hold.task.ledger).toBe("hold");
    const withProgram = setLisaPrincipalProgramRef(options, hold.task.internalId, "program-1", 2);
    expect(withProgram.programRef).toBe("program-1");
    expect(() => setLisaPrincipalProgramRef(options, hold.task.internalId, "program-2", 3)).toThrow(
      /immutable/,
    );
  });

  it("enforces canonical status and evidence rules without writing execution task-registry rows", () => {
    const options = storeOptions();
    const task = intakeLisaPrincipalTask(options, {
      title: "Ship packet",
      explicit: true,
      owner: "Lisa",
      nowMs: 1,
    }).task;
    const inProgress = transitionLisaPrincipalTask(options, {
      internalId: task.internalId,
      to: "in_progress",
      nowMs: 2,
    });
    expect(() =>
      transitionLisaPrincipalTask(options, {
        internalId: inProgress.internalId,
        to: "completed_verified",
        nowMs: 3,
      }),
    ).toThrow(/requires evidence/);
    const verified = transitionLisaPrincipalTask(options, {
      internalId: task.internalId,
      to: "completed_verified",
      evidence: [{ source: "Lisa", description: "Synthetic result", reference: "evidence-1" }],
      nowMs: 4,
    });
    expect(verified.status).toBe("completed_verified");
    const database = openOpenClawAgentDatabase(options);
    expect(
      database.db.prepare("SELECT 1 FROM sqlite_schema WHERE name = 'tasks'").get(),
    ).toBeUndefined();
    expect(
      database.db.prepare(`SELECT COUNT(*) AS count FROM ${LISA_PRINCIPAL_TASKS_TABLE}`).get(),
    ).toEqual({ count: 1 });
  });

  it("maps provider-outage P-* ids once onto an already assigned T-ID and does not bump schema version", () => {
    const options = storeOptions();
    const task = intakeLisaPrincipalTask(options, {
      title: "Held destination",
      explicit: true,
      owner: "Lisa",
      nowMs: 1,
    }).task;
    const pending = enqueueLisaPrincipalPending(options, { internalId: task.internalId, nowMs: 2 });
    expect(pending.pendingId).toBe("P-0001");
    expect(mapLisaPrincipalPending(options, pending.pendingId, task.displayRef).displayRef).toBe(
      "T-000001",
    );
    expect(mapLisaPrincipalPending(options, pending.pendingId, task.displayRef).displayRef).toBe(
      "T-000001",
    );
    expect(() => mapLisaPrincipalPending(options, pending.pendingId, "T-000999")).toThrow(
      /already mapped/,
    );
    expect(getLisaPrincipalTaskByDisplayRef(options, "T-000001")?.internalId).toBe(task.internalId);
    const database = openOpenClawAgentDatabase(options);
    expect(database.db.prepare("PRAGMA user_version").get()).toEqual({
      user_version: OPENCLAW_AGENT_SCHEMA_VERSION,
    });
  });
});

import { randomUUID } from "node:crypto";
import type { Insertable, Selectable } from "kysely";
import { executeSqliteQuerySync, getNodeSqliteKysely } from "../infra/kysely-sync.js";
import {
  ensureLisaPrincipalTaskSchema,
  LISA_PRINCIPAL_DISPLAY_REF_PATTERN,
  LISA_PRINCIPAL_DISPLAY_SEQ_TABLE,
  LISA_PRINCIPAL_TASK_ALIASES_TABLE,
  LISA_PRINCIPAL_TASK_EVENTS_TABLE,
  LISA_PRINCIPAL_TASK_PENDING_TABLE,
  LISA_PRINCIPAL_TASK_REFS_TABLE,
  LISA_PRINCIPAL_TASK_TRANSITIONS,
  LISA_PRINCIPAL_TASKS_TABLE,
  type LisaPrincipalChannelKind,
  type LisaPrincipalCompletionEvidence,
  type LisaPrincipalEstimate,
  type LisaPrincipalOwner,
  type LisaPrincipalPriority,
  type LisaPrincipalTaskCreateInput,
  type LisaPrincipalTaskRecord,
  type LisaPrincipalTaskStatus,
} from "./lisa-principal-task-schema.js";
import {
  openOpenClawAgentDatabase,
  runOpenClawAgentWriteTransaction,
  type OpenClawAgentDatabaseOptions,
} from "./openclaw-agent-db.js";

export { ensureLisaPrincipalTaskSchema };
export {
  LISA_PRINCIPAL_DISPLAY_REF_PATTERN,
  LISA_PRINCIPAL_TASK_STATUSES,
  LISA_PRINCIPAL_TASKS_TABLE,
  type LisaPrincipalChannelKind,
  type LisaPrincipalCompletionEvidence,
  type LisaPrincipalEstimate,
  type LisaPrincipalOwner,
  type LisaPrincipalPriority,
  type LisaPrincipalTaskCreateInput,
  type LisaPrincipalTaskRecord,
  type LisaPrincipalTaskStatus,
} from "./lisa-principal-task-schema.js";

export type LisaPrincipalTaskStoreOptions = OpenClawAgentDatabaseOptions;

type PrincipalTaskRow = {
  internal_id: string;
  display_ref: string;
  title: string;
  status: LisaPrincipalTaskStatus;
  source: "explicit" | "inferred";
  explicit: number;
  confirmed: number;
  urgent: number;
  priority: LisaPrincipalPriority;
  owner: LisaPrincipalOwner;
  ledger: "google_tasks" | "hold";
  difficulty_json: string;
  effort_periods_json: string;
  importance_json: string;
  dependencies_json: string;
  estimates_json: string;
  capacity: LisaPrincipalTaskRecord["capacity"];
  confirmation_due: "immediate" | "next-review";
  due_date: string | null;
  parent_internal_id: string | null;
  related_key: string | null;
  program_ref: string | null;
  brain_advisory_ref: string | null;
  created_at_ms: number;
  updated_at_ms: number;
};

type PrincipalTables = {
  [LISA_PRINCIPAL_TASKS_TABLE]: PrincipalTaskRow;
  [LISA_PRINCIPAL_TASK_REFS_TABLE]: {
    ref_kind: LisaPrincipalChannelKind;
    ref_value: string;
    internal_id: string;
    created_at_ms: number;
  };
  [LISA_PRINCIPAL_TASK_ALIASES_TABLE]: {
    alias_internal_id: string;
    canonical_internal_id: string;
    alias_display_ref: string;
    reason: string;
    created_at_ms: number;
  };
  [LISA_PRINCIPAL_TASK_EVENTS_TABLE]: {
    event_id: string;
    internal_id: string;
    from_status: LisaPrincipalTaskStatus | null;
    to_status: LisaPrincipalTaskStatus;
    evidence_json: string | null;
    created_at_ms: number;
  };
  [LISA_PRINCIPAL_TASK_PENDING_TABLE]: {
    pending_id: string;
    internal_id: string;
    created_at_ms: number;
  };
  [LISA_PRINCIPAL_DISPLAY_SEQ_TABLE]: { singleton: 1; next_value: number };
};

function estimate<T>(value: T): LisaPrincipalEstimate<T> {
  return { value, source: "Lisa estimate", overridable: true };
}

function requireText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`invalid ${label}`);
  }
  return trimmed;
}

function parseJson<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`invalid ${label}`);
  }
}

function rowToRecord(row: Selectable<PrincipalTaskRow>): LisaPrincipalTaskRecord {
  return {
    internalId: row.internal_id,
    displayRef: row.display_ref,
    title: row.title,
    status: row.status,
    source: row.source,
    explicit: row.explicit === 1,
    confirmed: row.confirmed === 1,
    urgent: row.urgent === 1,
    priority: row.priority,
    owner: row.owner,
    ledger: row.ledger,
    difficulty: parseJson(row.difficulty_json, "difficulty"),
    effortPeriods: parseJson(row.effort_periods_json, "effortPeriods"),
    importance: parseJson(row.importance_json, "importance"),
    dependencies: parseJson(row.dependencies_json, "dependencies"),
    capacity: row.capacity,
    confirmationDue: row.confirmation_due,
    estimates: parseJson(row.estimates_json, "estimates"),
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
    ...(row.due_date ? { dueDate: row.due_date } : {}),
    ...(row.parent_internal_id ? { parentInternalId: row.parent_internal_id } : {}),
    ...(row.related_key ? { relatedKey: row.related_key } : {}),
    ...(row.program_ref ? { programRef: row.program_ref } : {}),
    ...(row.brain_advisory_ref ? { brainAdvisoryRef: row.brain_advisory_ref } : {}),
  };
}

function kysely(db: ReturnType<typeof openOpenClawAgentDatabase>["db"]) {
  return getNodeSqliteKysely<PrincipalTables>(db);
}

function selectTask(
  db: ReturnType<typeof openOpenClawAgentDatabase>["db"],
  internalId: string,
): LisaPrincipalTaskRecord | undefined {
  const row = executeSqliteQuerySync(
    db,
    kysely(db)
      .selectFrom(LISA_PRINCIPAL_TASKS_TABLE)
      .selectAll()
      .where("internal_id", "=", internalId),
  ).rows[0];
  return row ? rowToRecord(row) : undefined;
}

function resolveCanonicalId(
  db: ReturnType<typeof openOpenClawAgentDatabase>["db"],
  internalId: string,
): string {
  const alias = executeSqliteQuerySync(
    db,
    kysely(db)
      .selectFrom(LISA_PRINCIPAL_TASK_ALIASES_TABLE)
      .select("canonical_internal_id")
      .where("alias_internal_id", "=", internalId),
  ).rows[0];
  return alias?.canonical_internal_id ?? internalId;
}

function lookupChannel(
  db: ReturnType<typeof openOpenClawAgentDatabase>["db"],
  kind: LisaPrincipalChannelKind,
  value: string,
): string | undefined {
  const row = executeSqliteQuerySync(
    db,
    kysely(db)
      .selectFrom(LISA_PRINCIPAL_TASK_REFS_TABLE)
      .select("internal_id")
      .where("ref_kind", "=", kind)
      .where("ref_value", "=", value),
  ).rows[0];
  return row?.internal_id;
}

function insertRef(
  db: ReturnType<typeof openOpenClawAgentDatabase>["db"],
  kind: LisaPrincipalChannelKind,
  value: string,
  internalId: string,
  nowMs: number,
): void {
  executeSqliteQuerySync(
    db,
    kysely(db)
      .insertInto(LISA_PRINCIPAL_TASK_REFS_TABLE)
      .values({
        ref_kind: kind,
        ref_value: value,
        internal_id: internalId,
        created_at_ms: nowMs,
      })
      .onConflict((conflict) => conflict.columns(["ref_kind", "ref_value"]).doNothing()),
  );
}

function nextDisplayRef(db: ReturnType<typeof openOpenClawAgentDatabase>["db"]): string {
  executeSqliteQuerySync(
    db,
    kysely(db)
      .insertInto(LISA_PRINCIPAL_DISPLAY_SEQ_TABLE)
      .values({ singleton: 1, next_value: 1 })
      .onConflict((conflict) => conflict.column("singleton").doNothing()),
  );
  const row = executeSqliteQuerySync(
    db,
    kysely(db)
      .selectFrom(LISA_PRINCIPAL_DISPLAY_SEQ_TABLE)
      .select("next_value")
      .where("singleton", "=", 1),
  ).rows[0];
  if (!row) {
    throw new Error("principal display sequence is missing");
  }
  executeSqliteQuerySync(
    db,
    kysely(db)
      .updateTable(LISA_PRINCIPAL_DISPLAY_SEQ_TABLE)
      .set({ next_value: row.next_value + 1 })
      .where("singleton", "=", 1),
  );
  return `T-${String(row.next_value).padStart(6, "0")}`;
}

function insertEvent(
  db: ReturnType<typeof openOpenClawAgentDatabase>["db"],
  input: {
    internalId: string;
    fromStatus: LisaPrincipalTaskStatus | null;
    toStatus: LisaPrincipalTaskStatus;
    evidence?: readonly LisaPrincipalCompletionEvidence[];
    nowMs: number;
  },
): void {
  executeSqliteQuerySync(
    db,
    kysely(db)
      .insertInto(LISA_PRINCIPAL_TASK_EVENTS_TABLE)
      .values({
        event_id: randomUUID(),
        internal_id: input.internalId,
        from_status: input.fromStatus,
        to_status: input.toStatus,
        evidence_json: input.evidence ? JSON.stringify(input.evidence) : null,
        created_at_ms: input.nowMs,
      }),
  );
}

function assertEvidence(
  status: LisaPrincipalTaskStatus,
  owner: LisaPrincipalOwner,
  evidence: readonly LisaPrincipalCompletionEvidence[] | undefined,
): void {
  if (status !== "completed_verified") {
    return;
  }
  if (owner === "Carlos") {
    if (!evidence?.some((entry) => entry.source === "Carlos" && entry.description.trim())) {
      throw new Error("Carlos completion requires Carlos's report");
    }
    return;
  }
  if (
    !evidence?.some(
      (entry) => entry.source !== "Carlos" && entry.description.trim() && entry.reference.trim(),
    )
  ) {
    throw new Error("Lisa or agent completion requires evidence");
  }
}

function insertTaskRow(
  db: ReturnType<typeof openOpenClawAgentDatabase>["db"],
  values: Insertable<PrincipalTaskRow>,
): void {
  executeSqliteQuerySync(db, kysely(db).insertInto(LISA_PRINCIPAL_TASKS_TABLE).values(values));
}

/** Assign a durable internal UUID and short T-ID on intake; never reuse a day counter. */
export function intakeLisaPrincipalTask(
  options: LisaPrincipalTaskStoreOptions,
  input: LisaPrincipalTaskCreateInput,
): { task: LisaPrincipalTaskRecord; created: boolean } {
  const title = requireText(input.title, "title");
  const nowMs = input.nowMs ?? Date.now();
  const owner = input.owner ?? "Carlos";
  const explicit = input.explicit;
  const urgent = input.urgent ?? false;
  const confirmed = explicit || urgent;
  const status: LisaPrincipalTaskStatus = confirmed ? "confirmed_ready" : "provisional";
  const source = explicit ? "explicit" : "inferred";
  const difficulty = estimate(input.difficulty ?? "medium");
  const effortPeriods = estimate(input.effortPeriods ?? 1);
  const importance = estimate(input.importance ?? 3);
  const dependencies = [...(input.dependencies ?? [])];
  return runOpenClawAgentWriteTransaction((database) => {
    ensureLisaPrincipalTaskSchema(database.db);
    if (input.channel) {
      const existingId = lookupChannel(
        database.db,
        input.channel.kind,
        requireText(input.channel.value, "channel value"),
      );
      if (existingId) {
        const existing = selectTask(database.db, resolveCanonicalId(database.db, existingId));
        if (!existing) {
          throw new Error("mapped principal task is missing");
        }
        return { task: existing, created: false };
      }
    }
    if (input.relatedKey) {
      const relatedId = lookupChannel(
        database.db,
        "related_key",
        requireText(input.relatedKey, "related key"),
      );
      if (relatedId) {
        const canonical = selectTask(database.db, resolveCanonicalId(database.db, relatedId));
        if (!canonical) {
          throw new Error("related principal task is missing");
        }
        if (input.channel) {
          insertRef(
            database.db,
            input.channel.kind,
            requireText(input.channel.value, "channel value"),
            canonical.internalId,
            nowMs,
          );
        }
        return { task: canonical, created: false };
      }
    }
    const internalId = randomUUID();
    const displayRef = nextDisplayRef(database.db);
    if (!LISA_PRINCIPAL_DISPLAY_REF_PATTERN.test(displayRef)) {
      throw new Error("invalid permanent ID");
    }
    insertTaskRow(database.db, {
      internal_id: internalId,
      display_ref: displayRef,
      title,
      status,
      source,
      explicit: explicit ? 1 : 0,
      confirmed: confirmed ? 1 : 0,
      urgent: urgent ? 1 : 0,
      priority: input.priority ?? "optional-improvement",
      owner,
      ledger: owner === "Carlos" ? "google_tasks" : "hold",
      difficulty_json: JSON.stringify(difficulty),
      effort_periods_json: JSON.stringify(effortPeriods),
      importance_json: JSON.stringify(importance),
      dependencies_json: JSON.stringify(dependencies),
      estimates_json: JSON.stringify({
        importance,
        difficulty,
        effortPeriods,
        dependencies: estimate(dependencies),
        owner: estimate(owner),
      }),
      capacity: input.capacity ?? "normal",
      confirmation_due: confirmed ? "immediate" : "next-review",
      due_date: input.dueDate ?? null,
      parent_internal_id: input.parentInternalId ?? null,
      related_key: input.relatedKey ?? null,
      program_ref: input.programRef ? requireText(input.programRef, "program ref") : null,
      brain_advisory_ref: input.brainAdvisoryRef ?? null,
      created_at_ms: nowMs,
      updated_at_ms: nowMs,
    });
    insertEvent(database.db, {
      internalId,
      fromStatus: null,
      toStatus: status,
      nowMs,
    });
    if (input.channel) {
      insertRef(
        database.db,
        input.channel.kind,
        requireText(input.channel.value, "channel value"),
        internalId,
        nowMs,
      );
    }
    if (input.relatedKey) {
      insertRef(
        database.db,
        "related_key",
        requireText(input.relatedKey, "related key"),
        internalId,
        nowMs,
      );
    }
    if (input.programRef) {
      insertRef(
        database.db,
        "program_ledger",
        requireText(input.programRef, "program ref"),
        internalId,
        nowMs,
      );
    }
    const task = selectTask(database.db, internalId);
    if (!task) {
      throw new Error("principal task insert did not persist");
    }
    return { task, created: true };
  }, options);
}

export function getLisaPrincipalTask(
  options: LisaPrincipalTaskStoreOptions,
  internalId: string,
): LisaPrincipalTaskRecord | undefined {
  const database = openOpenClawAgentDatabase(options);
  ensureLisaPrincipalTaskSchema(database.db);
  return selectTask(database.db, resolveCanonicalId(database.db, internalId));
}

export function getLisaPrincipalTaskByDisplayRef(
  options: LisaPrincipalTaskStoreOptions,
  displayRef: string,
): LisaPrincipalTaskRecord | undefined {
  if (!LISA_PRINCIPAL_DISPLAY_REF_PATTERN.test(displayRef)) {
    throw new Error("invalid permanent ID");
  }
  const database = openOpenClawAgentDatabase(options);
  ensureLisaPrincipalTaskSchema(database.db);
  const row = executeSqliteQuerySync(
    database.db,
    kysely(database.db)
      .selectFrom(LISA_PRINCIPAL_TASKS_TABLE)
      .selectAll()
      .where("display_ref", "=", displayRef),
  ).rows[0];
  return row ? rowToRecord(row) : undefined;
}

export function setLisaPrincipalProgramRef(
  options: LisaPrincipalTaskStoreOptions,
  internalId: string,
  programRef: string,
  nowMs = Date.now(),
): LisaPrincipalTaskRecord {
  const value = requireText(programRef, "program ref");
  return runOpenClawAgentWriteTransaction((database) => {
    ensureLisaPrincipalTaskSchema(database.db);
    const canonicalId = resolveCanonicalId(database.db, internalId);
    const current = selectTask(database.db, canonicalId);
    if (!current) {
      throw new Error("unknown principal task");
    }
    if (current.programRef && current.programRef !== value) {
      throw new Error("program references are immutable");
    }
    const existingProgram = lookupChannel(database.db, "program_ledger", value);
    if (existingProgram && existingProgram !== canonicalId) {
      throw new Error("program references are immutable");
    }
    executeSqliteQuerySync(
      database.db,
      kysely(database.db)
        .updateTable(LISA_PRINCIPAL_TASKS_TABLE)
        .set({ program_ref: value, updated_at_ms: nowMs })
        .where("internal_id", "=", canonicalId),
    );
    insertRef(database.db, "program_ledger", value, canonicalId, nowMs);
    const updated = selectTask(database.db, canonicalId);
    if (!updated) {
      throw new Error("principal task is missing after program-ref write");
    }
    return updated;
  }, options);
}

export function mergeLisaPrincipalTasks(
  options: LisaPrincipalTaskStoreOptions,
  input: { canonicalInternalId: string; duplicateInternalId: string; nowMs?: number },
): LisaPrincipalTaskRecord {
  const nowMs = input.nowMs ?? Date.now();
  return runOpenClawAgentWriteTransaction((database) => {
    ensureLisaPrincipalTaskSchema(database.db);
    const canonicalId = resolveCanonicalId(database.db, input.canonicalInternalId);
    const duplicateId = resolveCanonicalId(database.db, input.duplicateInternalId);
    if (canonicalId === duplicateId) {
      const same = selectTask(database.db, canonicalId);
      if (!same) {
        throw new Error("canonical principal task is missing");
      }
      return same;
    }
    const canonical = selectTask(database.db, canonicalId);
    const duplicate = selectTask(database.db, duplicateId);
    if (!canonical || !duplicate) {
      throw new Error("merge requires two persisted principal tasks");
    }
    executeSqliteQuerySync(
      database.db,
      kysely(database.db).insertInto(LISA_PRINCIPAL_TASK_ALIASES_TABLE).values({
        alias_internal_id: duplicate.internalId,
        canonical_internal_id: canonical.internalId,
        alias_display_ref: duplicate.displayRef,
        reason: "duplicate_merge",
        created_at_ms: nowMs,
      }),
    );
    executeSqliteQuerySync(
      database.db,
      kysely(database.db)
        .updateTable(LISA_PRINCIPAL_TASK_REFS_TABLE)
        .set({ internal_id: canonical.internalId })
        .where("internal_id", "=", duplicate.internalId),
    );
    return canonical;
  }, options);
}

export function transitionLisaPrincipalTask(
  options: LisaPrincipalTaskStoreOptions,
  input: {
    internalId: string;
    to: LisaPrincipalTaskStatus;
    evidence?: readonly LisaPrincipalCompletionEvidence[];
    nowMs?: number;
  },
): LisaPrincipalTaskRecord {
  const nowMs = input.nowMs ?? Date.now();
  return runOpenClawAgentWriteTransaction((database) => {
    ensureLisaPrincipalTaskSchema(database.db);
    const canonicalId = resolveCanonicalId(database.db, input.internalId);
    const current = selectTask(database.db, canonicalId);
    if (!current) {
      throw new Error("unknown principal task");
    }
    if (current.status === input.to) {
      return current;
    }
    if (!LISA_PRINCIPAL_TASK_TRANSITIONS[current.status].includes(input.to)) {
      throw new Error(`invalid task transition: ${current.status} -> ${input.to}`);
    }
    if (!current.confirmed && input.to === "completed_verified") {
      throw new Error("inferred work must be confirmed before completion");
    }
    assertEvidence(input.to, current.owner, input.evidence);
    const confirmed = input.to === "confirmed_ready" ? 1 : current.confirmed ? 1 : 0;
    executeSqliteQuerySync(
      database.db,
      kysely(database.db)
        .updateTable(LISA_PRINCIPAL_TASKS_TABLE)
        .set({
          status: input.to,
          confirmed,
          confirmation_due: confirmed ? "immediate" : current.confirmationDue,
          updated_at_ms: nowMs,
        })
        .where("internal_id", "=", canonicalId),
    );
    insertEvent(database.db, {
      internalId: canonicalId,
      fromStatus: current.status,
      toStatus: input.to,
      evidence: input.evidence,
      nowMs,
    });
    const updated = selectTask(database.db, canonicalId);
    if (!updated) {
      throw new Error("principal task is missing after transition");
    }
    return updated;
  }, options);
}

/** Provider-outage HOLD queue: temporary P-* maps once onto an already assigned T-ID. */
export function enqueueLisaPrincipalPending(
  options: LisaPrincipalTaskStoreOptions,
  input: { internalId: string; nowMs?: number },
): { pendingId: string; displayRef: string } {
  const nowMs = input.nowMs ?? Date.now();
  return runOpenClawAgentWriteTransaction((database) => {
    ensureLisaPrincipalTaskSchema(database.db);
    const task = selectTask(database.db, resolveCanonicalId(database.db, input.internalId));
    if (!task) {
      throw new Error("unknown principal task");
    }
    const count = executeSqliteQuerySync(
      database.db,
      kysely(database.db).selectFrom(LISA_PRINCIPAL_TASK_PENDING_TABLE).select("pending_id"),
    ).rows.length;
    const pendingId = `P-${String(count + 1).padStart(4, "0")}`;
    executeSqliteQuerySync(
      database.db,
      kysely(database.db)
        .insertInto(LISA_PRINCIPAL_TASK_PENDING_TABLE)
        .values({ pending_id: pendingId, internal_id: task.internalId, created_at_ms: nowMs }),
    );
    return { pendingId, displayRef: task.displayRef };
  }, options);
}

export function mapLisaPrincipalPending(
  options: LisaPrincipalTaskStoreOptions,
  pendingId: string,
  displayRef: string,
): { pendingId: string; displayRef: string } {
  if (!/^P-\d{4,}$/.test(pendingId)) {
    throw new Error(`invalid pending ID: ${pendingId}`);
  }
  if (!LISA_PRINCIPAL_DISPLAY_REF_PATTERN.test(displayRef)) {
    throw new Error("invalid permanent ID");
  }
  return runOpenClawAgentWriteTransaction((database) => {
    ensureLisaPrincipalTaskSchema(database.db);
    const pending = executeSqliteQuerySync(
      database.db,
      kysely(database.db)
        .selectFrom(LISA_PRINCIPAL_TASK_PENDING_TABLE)
        .selectAll()
        .where("pending_id", "=", pendingId),
    ).rows[0];
    if (!pending) {
      throw new Error(`unknown pending ID: ${pendingId}`);
    }
    const task = selectTask(database.db, pending.internal_id);
    if (!task || task.displayRef !== displayRef) {
      throw new Error(`pending ID already mapped: ${pendingId}`);
    }
    return { pendingId, displayRef };
  }, options);
}

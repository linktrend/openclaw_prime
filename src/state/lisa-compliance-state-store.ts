import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import type { Selectable } from "kysely";
import { executeSqliteQuerySync, getNodeSqliteKysely } from "../infra/kysely-sync.js";
import {
  ensureLisaComplianceStateSchema,
  LISA_COMPLIANCE_BATTERY_TABLE,
  LISA_COMPLIANCE_CAPACITY_TABLE,
  LISA_COMPLIANCE_HEALTH_OWNERSHIP_TABLE,
  LISA_COMPLIANCE_HYDRATION_TABLE,
  LISA_COMPLIANCE_SELFIE_TABLE,
  LISA_PRIVATE_HEALTH_FILENAME,
} from "./lisa-compliance-state-schema.js";
import {
  openOpenClawAgentDatabase,
  runOpenClawAgentWriteTransaction,
  type OpenClawAgentDatabaseOptions,
} from "./openclaw-agent-db.js";

export { ensureLisaComplianceStateSchema, LISA_PRIVATE_HEALTH_FILENAME };
export type LisaComplianceStoreOptions = OpenClawAgentDatabaseOptions & {
  agentStateDir?: string;
};

export type LisaWorkCapacity = "high" | "normal" | "reduced" | "unavailable" | "recovered";
export type LisaExternalCapacity = Exclude<LisaWorkCapacity, "high">;
export type LisaSelfieStatus = "Completed" | "Reported Late" | "Missed";
export type LisaComplianceAudience =
  | "work"
  | "provider"
  | "log"
  | "telemetry"
  | "export"
  | "fixture"
  | "subordinate"
  | "flash";

export type LisaBatteryObservation = {
  atMs: number;
  percentage: number;
  plugged: boolean;
  context: "desk" | "bedside" | "discharging";
  sourceEventId: string;
};

export type LisaHealthOwnership = {
  databasePath: string;
  directoryMode: 0o700;
  fileMode: 0o600;
  backupClass: "separated-private";
  replacesHealthDb: false;
};

const PRIVATE_LEAK_PATTERN =
  /(?:private[_ -]?health|mounjaro|medication|supplement|symptom|diagnos(?:e|is)|prescription|dosage|weight|waist|hydration|protein|sleep|mood|stress|digestion|bowel|clinical|treatment|selfie|battery)/iu;

const SELFIE_CONFIRMATION = /\b(done|taken|completed|complete|reported|yes|yep|finished)\b/iu;
const SELFIE_PROMISE = /\b(will|later|promise|going\s+to|plan\s+to|not\s+yet)\b/iu;

type ComplianceTables = {
  [LISA_COMPLIANCE_HEALTH_OWNERSHIP_TABLE]: {
    singleton: 1;
    database_filename: typeof LISA_PRIVATE_HEALTH_FILENAME;
    directory_mode: 448;
    file_mode: 384;
    backup_class: "separated-private";
    replaced_health_db: 0;
    updated_at_ms: number;
  };
  [LISA_COMPLIANCE_CAPACITY_TABLE]: {
    event_id: string;
    work_capacity: LisaWorkCapacity;
    external_capacity: LisaExternalCapacity;
    time_off_answer: "yes" | "no" | "not_asked";
    cause_recorded: 0;
    effective_at_ms: number;
  };
  [LISA_COMPLIANCE_BATTERY_TABLE]: {
    event_id: string;
    at_ms: number;
    percentage: number;
    plugged: number;
    context: LisaBatteryObservation["context"];
    source_event_id: string;
    predicted_35_at_ms: number | null;
    alert_idempotency_key: string | null;
    created_at_ms: number;
  };
  [LISA_COMPLIANCE_SELFIE_TABLE]: {
    local_date: string;
    status: LisaSelfieStatus;
    source_event_id: string;
    classified_hour: number;
    classified_minute: number;
    reminder_sent: number;
    updated_at_ms: number;
  };
  [LISA_COMPLIANCE_HYDRATION_TABLE]: {
    local_date: string;
    bottles_reported: number | null;
    consumed_ml: number | null;
    sleep_minutes: number | null;
    checkpoint: "morning" | "midday" | "evening";
    private_values_stored: 0;
    health_db_pointer: string;
    updated_at_ms: number;
  };
};

function kysely(db: ReturnType<typeof openOpenClawAgentDatabase>["db"]) {
  return getNodeSqliteKysely<ComplianceTables>(db);
}

export function mapLisaCapacityForWork(value: LisaWorkCapacity): LisaExternalCapacity {
  return value === "high" ? "normal" : value;
}

export function calculateLisaSleepDurationMinutes(
  sleepAtMs: number,
  wakeAtMs: number,
): number | "not_reported" {
  if (!Number.isFinite(sleepAtMs) || !Number.isFinite(wakeAtMs) || wakeAtMs <= sleepAtMs) {
    return "not_reported";
  }
  return Math.round((wakeAtMs - sleepAtMs) / 60_000);
}

export function calculateLisaHydrationConsumedMl(bottles: number): number | "not_reported" {
  if (!Number.isInteger(bottles) || bottles < 0 || bottles > 3) {
    return "not_reported";
  }
  return bottles * 1_000;
}

export function resolveLisaPrivateHealthPath(agentStateDir: string): string {
  if (!agentStateDir.trim()) {
    throw new Error("missing private health state directory");
  }
  return path.join(agentStateDir, LISA_PRIVATE_HEALTH_FILENAME);
}

export function prepareLisaPrivateHealthOwnership(agentStateDir: string): LisaHealthOwnership {
  mkdirSync(agentStateDir, { recursive: true, mode: 0o700 });
  chmodSync(agentStateDir, 0o700);
  const directoryMode = statSync(agentStateDir).mode & 0o777;
  if (directoryMode !== 0o700) {
    throw new Error("private health directory is not 0700");
  }
  return {
    databasePath: resolveLisaPrivateHealthPath(agentStateDir),
    directoryMode: 0o700,
    fileMode: 0o600,
    backupClass: "separated-private",
    replacesHealthDb: false,
  };
}

export function classifyLisaSelfieReport(
  hour: number,
  minute: number,
  sourceEventId: string,
  text: string,
): LisaSelfieStatus | "invalid_before_18" | "ambiguous" {
  if (
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error("invalid local time");
  }
  if (hour < 18) {
    return "invalid_before_18";
  }
  if (!sourceEventId.trim() || !SELFIE_CONFIRMATION.test(text) || SELFIE_PROMISE.test(text)) {
    return "ambiguous";
  }
  if (hour === 22 && minute > 0) {
    return "Reported Late";
  }
  return hour < 23 ? "Completed" : "Reported Late";
}

export function redactLisaComplianceForAudience(
  payload: unknown,
  audience: LisaComplianceAudience,
): unknown {
  if (audience === "flash") {
    if (payload && typeof payload === "object" && "batteryStatus" in payload) {
      return { batteryStatus: (payload as { batteryStatus: unknown }).batteryStatus };
    }
    return {};
  }
  const serialized = JSON.stringify(payload ?? {});
  if (PRIVATE_LEAK_PATTERN.test(serialized)) {
    throw new Error(`private compliance must not leak to ${audience}`);
  }
  return {};
}

function predicted35AtMs(observation: LisaBatteryObservation): number | null {
  if (observation.plugged || observation.context !== "discharging") {
    return null;
  }
  if (observation.percentage <= 35) {
    return observation.atMs;
  }
  return null;
}

export function recordLisaHealthOwnership(
  options: LisaComplianceStoreOptions,
  nowMs = Date.now(),
): LisaHealthOwnership {
  const agentStateDir = options.agentStateDir;
  if (!agentStateDir) {
    throw new Error("missing private health state directory");
  }
  const ownership = prepareLisaPrivateHealthOwnership(agentStateDir);
  return runOpenClawAgentWriteTransaction((database) => {
    ensureLisaComplianceStateSchema(database.db);
    executeSqliteQuerySync(
      database.db,
      kysely(database.db)
        .insertInto(LISA_COMPLIANCE_HEALTH_OWNERSHIP_TABLE)
        .values({
          singleton: 1,
          database_filename: LISA_PRIVATE_HEALTH_FILENAME,
          directory_mode: 448,
          file_mode: 384,
          backup_class: "separated-private",
          replaced_health_db: 0,
          updated_at_ms: nowMs,
        })
        .onConflict((conflict) =>
          conflict.column("singleton").doUpdateSet({
            updated_at_ms: nowMs,
            replaced_health_db: 0,
          }),
        ),
    );
    return ownership;
  }, options);
}

export function recordLisaWorkCapacity(
  options: LisaComplianceStoreOptions,
  input: {
    workCapacity: LisaWorkCapacity;
    timeOffAnswer?: "yes" | "no" | "not_asked";
    effectiveAtMs?: number;
  },
): {
  workCapacity: LisaWorkCapacity;
  externalCapacity: LisaExternalCapacity;
  causeRecorded: false;
} {
  const effectiveAtMs = input.effectiveAtMs ?? Date.now();
  const externalCapacity = mapLisaCapacityForWork(input.workCapacity);
  return runOpenClawAgentWriteTransaction((database) => {
    ensureLisaComplianceStateSchema(database.db);
    executeSqliteQuerySync(
      database.db,
      kysely(database.db)
        .insertInto(LISA_COMPLIANCE_CAPACITY_TABLE)
        .values({
          event_id: randomUUID(),
          work_capacity: input.workCapacity,
          external_capacity: externalCapacity,
          time_off_answer: input.timeOffAnswer ?? "not_asked",
          cause_recorded: 0,
          effective_at_ms: effectiveAtMs,
        }),
    );
    return { workCapacity: input.workCapacity, externalCapacity, causeRecorded: false };
  }, options);
}

export function recordLisaBatteryObservation(
  options: LisaComplianceStoreOptions,
  observation: LisaBatteryObservation,
): { alertIdempotencyKey: string | null; predicted35AtMs: number | null } {
  if (
    !Number.isInteger(observation.percentage) ||
    observation.percentage < 0 ||
    observation.percentage > 100
  ) {
    throw new Error("invalid battery percentage");
  }
  if (observation.plugged && observation.context === "discharging") {
    throw new Error("plugged battery cannot use discharging context");
  }
  const predicted = predicted35AtMs(observation);
  const alertKey =
    !observation.plugged && predicted !== null
      ? `${observation.sourceEventId}:35:${predicted}`
      : null;
  return runOpenClawAgentWriteTransaction((database) => {
    ensureLisaComplianceStateSchema(database.db);
    const existing = executeSqliteQuerySync(
      database.db,
      kysely(database.db)
        .selectFrom(LISA_COMPLIANCE_BATTERY_TABLE)
        .select("alert_idempotency_key")
        .where("source_event_id", "=", observation.sourceEventId),
    ).rows[0];
    if (existing) {
      return {
        alertIdempotencyKey: existing.alert_idempotency_key,
        predicted35AtMs: predicted,
      };
    }
    executeSqliteQuerySync(
      database.db,
      kysely(database.db)
        .insertInto(LISA_COMPLIANCE_BATTERY_TABLE)
        .values({
          event_id: randomUUID(),
          at_ms: observation.atMs,
          percentage: observation.percentage,
          plugged: observation.plugged ? 1 : 0,
          context: observation.context,
          source_event_id: observation.sourceEventId,
          predicted_35_at_ms: predicted,
          alert_idempotency_key: alertKey,
          created_at_ms: observation.atMs,
        }),
    );
    return { alertIdempotencyKey: alertKey, predicted35AtMs: predicted };
  }, options);
}

export function recordLisaSelfieDay(
  options: LisaComplianceStoreOptions,
  input: {
    localDate: string;
    hour: number;
    minute: number;
    sourceEventId: string;
    text?: string;
    midnightClose?: boolean;
    nowMs?: number;
  },
): { status: LisaSelfieStatus; reminder: boolean } {
  const nowMs = input.nowMs ?? Date.now();
  const classified = input.midnightClose
    ? "Missed"
    : classifyLisaSelfieReport(input.hour, input.minute, input.sourceEventId, input.text ?? "");
  if (classified === "invalid_before_18" || classified === "ambiguous") {
    throw new Error(`selfie classification is ${classified}`);
  }
  return runOpenClawAgentWriteTransaction((database) => {
    ensureLisaComplianceStateSchema(database.db);
    const existing = executeSqliteQuerySync(
      database.db,
      kysely(database.db)
        .selectFrom(LISA_COMPLIANCE_SELFIE_TABLE)
        .selectAll()
        .where("local_date", "=", input.localDate),
    ).rows[0] as Selectable<ComplianceTables[typeof LISA_COMPLIANCE_SELFIE_TABLE]> | undefined;
    if (existing) {
      return { status: existing.status, reminder: existing.reminder_sent === 1 };
    }
    const reminder = classified === "Missed";
    executeSqliteQuerySync(
      database.db,
      kysely(database.db)
        .insertInto(LISA_COMPLIANCE_SELFIE_TABLE)
        .values({
          local_date: input.localDate,
          status: classified,
          source_event_id: input.sourceEventId,
          classified_hour: input.hour,
          classified_minute: input.minute,
          reminder_sent: reminder ? 1 : 0,
          updated_at_ms: nowMs,
        }),
    );
    return { status: classified, reminder };
  }, options);
}

export function recordLisaHydrationCheckpoint(
  options: LisaComplianceStoreOptions,
  input: {
    localDate: string;
    checkpoint: "morning" | "midday" | "evening";
    bottles?: number;
    sleepAtMs?: number;
    wakeAtMs?: number;
    nowMs?: number;
  },
): { consumedMl: number | "not_reported"; sleepMinutes: number | "not_reported" } {
  const consumedMl =
    input.bottles === undefined ? "not_reported" : calculateLisaHydrationConsumedMl(input.bottles);
  const sleepMinutes =
    input.sleepAtMs === undefined || input.wakeAtMs === undefined
      ? "not_reported"
      : calculateLisaSleepDurationMinutes(input.sleepAtMs, input.wakeAtMs);
  const ownership = options.agentStateDir
    ? resolveLisaPrivateHealthPath(options.agentStateDir)
    : LISA_PRIVATE_HEALTH_FILENAME;
  return runOpenClawAgentWriteTransaction((database) => {
    ensureLisaComplianceStateSchema(database.db);
    executeSqliteQuerySync(
      database.db,
      kysely(database.db)
        .insertInto(LISA_COMPLIANCE_HYDRATION_TABLE)
        .values({
          local_date: input.localDate,
          bottles_reported: input.bottles ?? null,
          consumed_ml: consumedMl === "not_reported" ? null : consumedMl,
          sleep_minutes: sleepMinutes === "not_reported" ? null : sleepMinutes,
          checkpoint: input.checkpoint,
          private_values_stored: 0,
          health_db_pointer: ownership,
          updated_at_ms: input.nowMs ?? Date.now(),
        })
        .onConflict((conflict) =>
          conflict.column("local_date").doUpdateSet({
            bottles_reported: input.bottles ?? null,
            consumed_ml: consumedMl === "not_reported" ? null : consumedMl,
            sleep_minutes: sleepMinutes === "not_reported" ? null : sleepMinutes,
            checkpoint: input.checkpoint,
            private_values_stored: 0,
            health_db_pointer: ownership,
            updated_at_ms: input.nowMs ?? Date.now(),
          }),
        ),
    );
    return { consumedMl, sleepMinutes };
  }, options);
}

export function readLisaComplianceTables(options: LisaComplianceStoreOptions): readonly string[] {
  const database = openOpenClawAgentDatabase(options);
  ensureLisaComplianceStateSchema(database.db);
  return executeSqliteQuerySync(
    database.db,
    kysely(database.db)
      .selectFrom(LISA_COMPLIANCE_HEALTH_OWNERSHIP_TABLE)
      .select("database_filename"),
  ).rows.map((row) => row.database_filename);
}

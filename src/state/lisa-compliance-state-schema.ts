import type { DatabaseSync } from "node:sqlite";
import { runSqliteImmediateTransactionSync } from "../infra/sqlite-transaction.js";

/**
 * Private compliance tables stay on the Lisa agent DB. Detailed health remains
 * in the dedicated health file; these rows only hold capacity, battery, selfie,
 * and health-file ownership metadata.
 */
export const LISA_PRIVATE_HEALTH_FILENAME = "lisa-private-health.sqlite";
export const LISA_COMPLIANCE_HEALTH_OWNERSHIP_TABLE = "lisa_compliance_health_ownership";
export const LISA_COMPLIANCE_CAPACITY_TABLE = "lisa_compliance_capacity";
export const LISA_COMPLIANCE_BATTERY_TABLE = "lisa_compliance_battery_events";
export const LISA_COMPLIANCE_SELFIE_TABLE = "lisa_compliance_selfie_days";
export const LISA_COMPLIANCE_HYDRATION_TABLE = "lisa_compliance_hydration";

export const LISA_COMPLIANCE_STATE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS lisa_compliance_health_ownership (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  database_filename TEXT NOT NULL CHECK (database_filename = 'lisa-private-health.sqlite'),
  directory_mode INTEGER NOT NULL CHECK (directory_mode = 448),
  file_mode INTEGER NOT NULL CHECK (file_mode = 384),
  backup_class TEXT NOT NULL CHECK (backup_class = 'separated-private'),
  replaced_health_db INTEGER NOT NULL CHECK (replaced_health_db = 0),
  updated_at_ms INTEGER NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS lisa_compliance_capacity (
  event_id TEXT PRIMARY KEY,
  work_capacity TEXT NOT NULL CHECK (work_capacity IN (
    'high', 'normal', 'reduced', 'unavailable', 'recovered'
  )),
  external_capacity TEXT NOT NULL CHECK (external_capacity IN (
    'normal', 'reduced', 'unavailable', 'recovered'
  )),
  time_off_answer TEXT NOT NULL CHECK (time_off_answer IN ('yes', 'no', 'not_asked')),
  cause_recorded INTEGER NOT NULL CHECK (cause_recorded = 0),
  effective_at_ms INTEGER NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_lisa_compliance_capacity_time
  ON lisa_compliance_capacity (effective_at_ms);

CREATE TABLE IF NOT EXISTS lisa_compliance_battery_events (
  event_id TEXT PRIMARY KEY,
  at_ms INTEGER NOT NULL,
  percentage INTEGER NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  plugged INTEGER NOT NULL CHECK (plugged IN (0, 1)),
  context TEXT NOT NULL CHECK (context IN ('desk', 'bedside', 'discharging')),
  source_event_id TEXT NOT NULL,
  predicted_35_at_ms INTEGER,
  alert_idempotency_key TEXT,
  created_at_ms INTEGER NOT NULL
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lisa_compliance_battery_source
  ON lisa_compliance_battery_events (source_event_id);

CREATE TABLE IF NOT EXISTS lisa_compliance_selfie_days (
  local_date TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('Completed', 'Reported Late', 'Missed')),
  source_event_id TEXT NOT NULL,
  classified_hour INTEGER NOT NULL,
  classified_minute INTEGER NOT NULL,
  reminder_sent INTEGER NOT NULL CHECK (reminder_sent IN (0, 1)),
  updated_at_ms INTEGER NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS lisa_compliance_hydration (
  local_date TEXT PRIMARY KEY,
  bottles_reported INTEGER,
  consumed_ml INTEGER,
  sleep_minutes INTEGER,
  checkpoint TEXT NOT NULL CHECK (checkpoint IN ('morning', 'midday', 'evening')),
  private_values_stored INTEGER NOT NULL CHECK (private_values_stored = 0),
  health_db_pointer TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;
`;

const ENSURED_DATABASES = new WeakSet<DatabaseSync>();

/** Lazily install additive private-compliance tables on first feature use. */
export function ensureLisaComplianceStateSchema(db: DatabaseSync): void {
  if (ENSURED_DATABASES.has(db)) {
    return;
  }
  const ensure = () => {
    db.exec(LISA_COMPLIANCE_STATE_SCHEMA_SQL); // sqlite-allow-raw -- Feature-local additive DDL only.
  };
  if (db.isTransaction) {
    ensure();
  } else {
    runSqliteImmediateTransactionSync(db, ensure);
  }
  ENSURED_DATABASES.add(db);
}

import type { DatabaseSync } from "node:sqlite";
import { runSqliteImmediateTransactionSync } from "../infra/sqlite-transaction.js";

/**
 * Additive Principal-task tables live on Lisa's agent DB. They stay feature-local
 * so older readers keep working without an agent schema-version bump.
 */
export const LISA_PRINCIPAL_TASKS_TABLE = "lisa_principal_tasks";
export const LISA_PRINCIPAL_TASK_REFS_TABLE = "lisa_principal_task_refs";
export const LISA_PRINCIPAL_TASK_ALIASES_TABLE = "lisa_principal_task_aliases";
export const LISA_PRINCIPAL_TASK_EVENTS_TABLE = "lisa_principal_task_events";
export const LISA_PRINCIPAL_TASK_PENDING_TABLE = "lisa_principal_task_pending";
export const LISA_PRINCIPAL_DISPLAY_SEQ_TABLE = "lisa_principal_display_seq";

/** Public display syntax for this packet: `T-` plus at least six digits. */
export const LISA_PRINCIPAL_DISPLAY_REF_PATTERN = /^T-\d{6,}$/;

export const LISA_PRINCIPAL_TASK_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS lisa_principal_display_seq (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  next_value INTEGER NOT NULL CHECK (next_value >= 1)
) STRICT;

CREATE TABLE IF NOT EXISTS lisa_principal_tasks (
  internal_id TEXT PRIMARY KEY,
  display_ref TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'provisional',
    'confirmed_ready',
    'scheduled',
    'in_progress',
    'blocked',
    'awaiting_carlos',
    'awaiting_other',
    'completed_pending_evidence',
    'completed_verified'
  )),
  source TEXT NOT NULL CHECK (source IN ('explicit', 'inferred')),
  explicit INTEGER NOT NULL CHECK (explicit IN (0, 1)),
  confirmed INTEGER NOT NULL CHECK (confirmed IN (0, 1)),
  urgent INTEGER NOT NULL CHECK (urgent IN (0, 1)),
  priority TEXT NOT NULL,
  owner TEXT NOT NULL CHECK (owner IN ('Carlos', 'Lisa', 'subordinate-agent', 'conversation-work')),
  ledger TEXT NOT NULL CHECK (ledger IN ('google_tasks', 'hold')),
  difficulty_json TEXT NOT NULL,
  effort_periods_json TEXT NOT NULL,
  importance_json TEXT NOT NULL,
  dependencies_json TEXT NOT NULL,
  estimates_json TEXT NOT NULL,
  capacity TEXT NOT NULL,
  confirmation_due TEXT NOT NULL CHECK (confirmation_due IN ('immediate', 'next-review')),
  due_date TEXT,
  parent_internal_id TEXT,
  related_key TEXT,
  program_ref TEXT,
  brain_advisory_ref TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS lisa_principal_task_refs (
  ref_kind TEXT NOT NULL CHECK (ref_kind IN (
    'google_task',
    'brain_advisory',
    'program_ledger',
    'email',
    'message',
    'handoff',
    'telegram',
    'browser_chat',
    'related_key'
  )),
  ref_value TEXT NOT NULL,
  internal_id TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  PRIMARY KEY (ref_kind, ref_value)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_lisa_principal_task_refs_internal
  ON lisa_principal_task_refs (internal_id);

CREATE TABLE IF NOT EXISTS lisa_principal_task_aliases (
  alias_internal_id TEXT PRIMARY KEY,
  canonical_internal_id TEXT NOT NULL,
  alias_display_ref TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS lisa_principal_task_events (
  event_id TEXT PRIMARY KEY,
  internal_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  evidence_json TEXT,
  created_at_ms INTEGER NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_lisa_principal_task_events_task
  ON lisa_principal_task_events (internal_id, created_at_ms);

CREATE TABLE IF NOT EXISTS lisa_principal_task_pending (
  pending_id TEXT PRIMARY KEY,
  internal_id TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
) STRICT;
`;

const ENSURED_DATABASES = new WeakSet<DatabaseSync>();

/** Lazily install additive Principal-task tables on first feature use. */
export function ensureLisaPrincipalTaskSchema(db: DatabaseSync): void {
  if (ENSURED_DATABASES.has(db)) {
    return;
  }
  const ensure = () => {
    db.exec(LISA_PRINCIPAL_TASK_SCHEMA_SQL); // sqlite-allow-raw -- Feature-local additive DDL only.
  };
  if (db.isTransaction) {
    ensure();
  } else {
    runSqliteImmediateTransactionSync(db, ensure);
  }
  ENSURED_DATABASES.add(db);
}

export const LISA_PRINCIPAL_TASK_STATUSES = [
  "provisional",
  "confirmed_ready",
  "scheduled",
  "in_progress",
  "blocked",
  "awaiting_carlos",
  "awaiting_other",
  "completed_pending_evidence",
  "completed_verified",
] as const;

export type LisaPrincipalTaskStatus = (typeof LISA_PRINCIPAL_TASK_STATUSES)[number];
export type LisaPrincipalOwner = "Carlos" | "Lisa" | "subordinate-agent" | "conversation-work";
export type LisaPrincipalPriority =
  | "prevent-harm-or-hard-deadline"
  | "unblock-dependent-work"
  | "current-weekly-outcome"
  | "routine-maintenance"
  | "optional-improvement";
export type LisaPrincipalEstimate<T> = {
  value: T;
  source: "Lisa estimate";
  overridable: true;
};
export type LisaPrincipalChannelKind =
  | "google_task"
  | "brain_advisory"
  | "program_ledger"
  | "email"
  | "message"
  | "handoff"
  | "telegram"
  | "browser_chat"
  | "related_key";
export type LisaPrincipalCompletionEvidence =
  | { source: "Lisa" | "subordinate-agent"; description: string; reference: string }
  | { source: "Carlos"; description: string };

export type LisaPrincipalTaskRecord = {
  internalId: string;
  displayRef: string;
  title: string;
  status: LisaPrincipalTaskStatus;
  source: "explicit" | "inferred";
  explicit: boolean;
  confirmed: boolean;
  urgent: boolean;
  priority: LisaPrincipalPriority;
  owner: LisaPrincipalOwner;
  ledger: "google_tasks" | "hold";
  difficulty: LisaPrincipalEstimate<"easy" | "medium" | "hard">;
  effortPeriods: LisaPrincipalEstimate<number>;
  importance: LisaPrincipalEstimate<number>;
  dependencies: readonly string[];
  capacity: "high" | "normal" | "reduced" | "unavailable" | "recovered";
  confirmationDue: "immediate" | "next-review";
  estimates: {
    importance: LisaPrincipalEstimate<number>;
    difficulty: LisaPrincipalEstimate<"easy" | "medium" | "hard">;
    effortPeriods: LisaPrincipalEstimate<number>;
    dependencies: LisaPrincipalEstimate<readonly string[]>;
    owner: LisaPrincipalEstimate<LisaPrincipalOwner>;
  };
  dueDate?: string;
  parentInternalId?: string;
  relatedKey?: string;
  programRef?: string;
  brainAdvisoryRef?: string;
  createdAtMs: number;
  updatedAtMs: number;
};

export type LisaPrincipalTaskCreateInput = {
  title: string;
  explicit: boolean;
  urgent?: boolean;
  nowMs?: number;
  priority?: LisaPrincipalPriority;
  owner?: LisaPrincipalOwner;
  difficulty?: "easy" | "medium" | "hard";
  effortPeriods?: number;
  importance?: number;
  dependencies?: readonly string[];
  capacity?: LisaPrincipalTaskRecord["capacity"];
  dueDate?: string;
  parentInternalId?: string;
  relatedKey?: string;
  programRef?: string;
  brainAdvisoryRef?: string;
  channel?: { kind: LisaPrincipalChannelKind; value: string };
};

export const LISA_PRINCIPAL_TASK_TRANSITIONS: Readonly<
  Record<LisaPrincipalTaskStatus, readonly LisaPrincipalTaskStatus[]>
> = {
  provisional: ["confirmed_ready"],
  confirmed_ready: ["scheduled", "in_progress", "blocked"],
  scheduled: ["in_progress", "blocked"],
  in_progress: [
    "blocked",
    "awaiting_carlos",
    "awaiting_other",
    "completed_pending_evidence",
    "completed_verified",
  ],
  blocked: ["confirmed_ready", "in_progress", "awaiting_other"],
  awaiting_carlos: ["confirmed_ready", "in_progress"],
  awaiting_other: ["in_progress", "blocked", "completed_pending_evidence"],
  completed_pending_evidence: ["in_progress", "completed_verified"],
  completed_verified: [],
};

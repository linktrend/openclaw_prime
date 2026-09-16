/** Shared, provider-neutral contracts for Lisa's ten default-disabled jobs. */

export const LISA_JOB_TIME_ZONE = "Asia/Taipei" as const;

export const LISA_JOB_IDS = [
  "librarian",
  "memory_dreaming",
  "backup",
  "executive_digest",
  "flash_report",
  "selfie",
  "battery_tracking",
  "battery_alert_35",
  "time_management",
  "private_health",
] as const;

export type LisaJobId = (typeof LISA_JOB_IDS)[number];

export type LisaJobRunState =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped_dependency"
  | "retrying";

export const LISA_TERMINAL_JOB_RUN_STATES = [
  "completed",
  "failed",
  "skipped_dependency",
] as const satisfies readonly LisaJobRunState[];

export type LisaPrivacyClass = "work" | "personal_compliance" | "private_health";
export type LisaGenericPrivacyClass = Exclude<LisaPrivacyClass, "private_health">;

export type LisaScheduleMetadata = {
  readonly timeZone: typeof LISA_JOB_TIME_ZONE;
  readonly localTimes: readonly string[];
  readonly deadlineLocalTime?: string;
  readonly enabled: false;
  readonly deliveryMode: "none";
};

/** Source intent only. WP-07 owns catalogue registration and activation gates. */
export const LISA_JOB_SCHEDULE_METADATA: Readonly<Record<LisaJobId, LisaScheduleMetadata>> = {
  librarian: {
    timeZone: LISA_JOB_TIME_ZONE,
    localTimes: ["03:30"],
    deadlineLocalTime: "04:30",
    enabled: false,
    deliveryMode: "none",
  },
  memory_dreaming: {
    timeZone: LISA_JOB_TIME_ZONE,
    localTimes: ["04:30"],
    deadlineLocalTime: "05:30",
    enabled: false,
    deliveryMode: "none",
  },
  backup: {
    timeZone: LISA_JOB_TIME_ZONE,
    localTimes: ["05:30"],
    deadlineLocalTime: "06:30",
    enabled: false,
    deliveryMode: "none",
  },
  executive_digest: {
    timeZone: LISA_JOB_TIME_ZONE,
    localTimes: ["07:00", "17:00"],
    enabled: false,
    deliveryMode: "none",
  },
  flash_report: {
    timeZone: LISA_JOB_TIME_ZONE,
    localTimes: ["10:45", "12:45", "14:45", "20:45", "22:45"],
    enabled: false,
    deliveryMode: "none",
  },
  selfie: {
    timeZone: LISA_JOB_TIME_ZONE,
    localTimes: ["17:45", "21:45", "23:59"],
    deadlineLocalTime: "23:59",
    enabled: false,
    deliveryMode: "none",
  },
  battery_tracking: {
    timeZone: LISA_JOB_TIME_ZONE,
    localTimes: ["08:15", "10:45", "14:45", "17:45", "22:45"],
    enabled: false,
    deliveryMode: "none",
  },
  battery_alert_35: {
    timeZone: LISA_JOB_TIME_ZONE,
    localTimes: ["hourly"],
    enabled: false,
    deliveryMode: "none",
  },
  time_management: {
    timeZone: LISA_JOB_TIME_ZONE,
    localTimes: ["07:45", "16:45"],
    enabled: false,
    deliveryMode: "none",
  },
  private_health: {
    timeZone: LISA_JOB_TIME_ZONE,
    localTimes: ["08:15", "13:15", "22:45"],
    enabled: false,
    deliveryMode: "none",
  },
};

export type LisaCycleIdentity = {
  readonly jobId: LisaJobId;
  readonly cycleId: string;
  readonly localDate: string;
};

export type LisaProviderReceiptReference = {
  readonly providerId: string;
  readonly releaseRef: string;
  readonly contractRef: string;
  readonly receivedAtMs: number;
};

export type LisaDependencyReceipt = LisaCycleIdentity & {
  readonly receiptId: string;
  readonly producerCompletedAtMs: number;
  readonly payloadHash: string;
  readonly provider: LisaProviderReceiptReference;
};

export type LisaDeliveryAttemptStatus = "started" | "succeeded" | "failed";

export type LisaDeliveryAttempt = {
  readonly attemptId: string;
  readonly channel: string;
  readonly destinationBindingId: string;
  readonly idempotencyKey: string;
  readonly attempt: number;
  readonly renderedHash: string;
  readonly status: LisaDeliveryAttemptStatus;
  readonly providerReceiptId: string | null;
  readonly startedAtMs: number;
  readonly finishedAtMs: number | null;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
};

/** Closed Lisa provider-policy outcomes. Silent success is unrepresentable. */
export const LISA_PROVIDER_POLICY_STATUSES = [
  "accepted",
  "denied",
  "unavailable",
  "invalid",
] as const;
export type LisaProviderPolicyStatus = (typeof LISA_PROVIDER_POLICY_STATUSES)[number];

export type LisaProviderFailureCode =
  | "unavailable"
  | "timeout"
  | "unauthorized"
  | "invalid_receipt"
  | "rate_limited"
  | "rejected"
  | "unknown";

export type LisaProviderFailure = {
  readonly code: LisaProviderFailureCode;
  readonly operatorDetail: string;
};

const LOCAL_TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/u;
const SHA256_RE = /^[a-f0-9]{64}$/u;
const SAFE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const RELEASE_RE = /^[A-Za-z0-9][A-Za-z0-9._/@+-]{0,127}$/u;
function containsOperatorControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if ((code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31)) {
      return true;
    }
  }
  return false;
}

export function isLisaJobId(value: unknown): value is LisaJobId {
  return typeof value === "string" && (LISA_JOB_IDS as readonly string[]).includes(value);
}

export function assertLisaJobId(value: unknown): asserts value is LisaJobId {
  if (!isLisaJobId(value)) {
    throw new Error(`invalid Lisa job id: ${String(value)}`);
  }
}

export function isLisaJobRunState(value: unknown): value is LisaJobRunState {
  return (
    value === "pending" ||
    value === "running" ||
    value === "completed" ||
    value === "failed" ||
    value === "skipped_dependency" ||
    value === "retrying"
  );
}

export function isLisaTerminalJobRunState(value: unknown): value is LisaJobRunState {
  return value === "completed" || value === "failed" || value === "skipped_dependency";
}

export function assertLisaJobRunState(value: unknown): asserts value is LisaJobRunState {
  if (!isLisaJobRunState(value)) {
    throw new Error(`invalid Lisa job run state: ${String(value)}`);
  }
}

export function isLisaLocalDate(value: unknown): value is string {
  if (typeof value !== "string" || !LOCAL_DATE_RE.test(value)) {
    return false;
  }
  const parts = value.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function assertLisaLocalDate(value: unknown): asserts value is string {
  if (!isLisaLocalDate(value)) {
    throw new Error(`invalid Lisa local date: ${String(value)}`);
  }
}

export function isSha256Hash(value: unknown): value is string {
  return typeof value === "string" && SHA256_RE.test(value);
}

export function assertSha256Hash(value: unknown, fieldName = "hash"): asserts value is string {
  if (!isSha256Hash(value)) {
    throw new Error(`${fieldName} must be a lowercase SHA-256 hex digest`);
  }
}

export function assertLisaScheduleMetadata(value: unknown): asserts value is LisaScheduleMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("schedule metadata must be an object");
  }
  const metadata = value as Partial<LisaScheduleMetadata>;
  if (metadata.timeZone !== LISA_JOB_TIME_ZONE || metadata.enabled !== false) {
    throw new Error("Lisa schedules must use Asia/Taipei and remain disabled");
  }
  if (metadata.deliveryMode !== "none") {
    throw new Error("Lisa source schedules must use delivery mode none");
  }
  if (
    !Array.isArray(metadata.localTimes) ||
    metadata.localTimes.length === 0 ||
    metadata.localTimes.some((time) => typeof time !== "string" && time !== "hourly") ||
    metadata.localTimes.some((time) => time !== "hourly" && !LOCAL_TIME_RE.test(time))
  ) {
    throw new Error("schedule metadata contains an invalid local time");
  }
  if (metadata.deadlineLocalTime !== undefined && !LOCAL_TIME_RE.test(metadata.deadlineLocalTime)) {
    throw new Error("schedule metadata contains an invalid deadline");
  }
}

export function assertSafeIdentifier(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== "string" || !SAFE_ID_RE.test(value)) {
    throw new Error(`${fieldName} must be a non-address binding identifier`);
  }
}

export function assertDestinationBindingId(
  value: unknown,
  fieldName = "destinationBindingId",
): asserts value is string {
  assertSafeIdentifier(value, fieldName);
  if (!/^[A-Za-z]/u.test(value)) {
    throw new Error(`${fieldName} must be a named destination binding identifier`);
  }
}

export function assertLisaErrorCode(
  value: unknown,
  fieldName = "errorCode",
): asserts value is string {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_:-]{0,63}$/u.test(value)) {
    throw new Error(`${fieldName} must be a payload-free lowercase error code`);
  }
}

export function assertProviderReceiptReference(
  value: unknown,
): asserts value is LisaProviderReceiptReference {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("provider receipt reference must be an object");
  }
  const reference = value as Partial<LisaProviderReceiptReference>;
  assertSafeIdentifier(reference.providerId, "providerId");
  if (
    typeof reference.releaseRef !== "string" ||
    !RELEASE_RE.test(reference.releaseRef) ||
    /(token|secret|password|bearer)/iu.test(reference.releaseRef)
  ) {
    throw new Error("provider release reference is invalid");
  }
  if (
    typeof reference.contractRef !== "string" ||
    !RELEASE_RE.test(reference.contractRef) ||
    /(token|secret|password|bearer)/iu.test(reference.contractRef)
  ) {
    throw new Error("provider contract reference is invalid");
  }
  assertTimestamp(reference.receivedAtMs, "provider receipt timestamp");
}

export function assertTimestamp(value: unknown, fieldName: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer timestamp`);
  }
}

export function assertProviderFailure(value: unknown): asserts value is LisaProviderFailure {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("provider failure must be an object");
  }
  const failure = value as Partial<LisaProviderFailure>;
  if (
    failure.code !== "unavailable" &&
    failure.code !== "timeout" &&
    failure.code !== "unauthorized" &&
    failure.code !== "invalid_receipt" &&
    failure.code !== "rate_limited" &&
    failure.code !== "rejected" &&
    failure.code !== "unknown"
  ) {
    throw new Error("invalid provider failure code");
  }
  if (
    typeof failure.operatorDetail !== "string" ||
    failure.operatorDetail.length === 0 ||
    failure.operatorDetail.length > 240 ||
    containsOperatorControlCharacter(failure.operatorDetail) ||
    /(?:[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|bearer\s+|(?:token|secret|password)\s*[:=]|chat[_ -]?id|drive[_ -]?id)/iu.test(
      failure.operatorDetail,
    )
  ) {
    throw new Error("provider operator detail is not safe");
  }
}

/** The generic operational store may expose only these two privacy classes. */
export function isLisaGenericPrivacyClass(value: unknown): value is LisaGenericPrivacyClass {
  return value === "work" || value === "personal_compliance";
}

export function assertLisaGenericPrivacyClass(
  value: unknown,
): asserts value is LisaGenericPrivacyClass {
  if (!isLisaGenericPrivacyClass(value)) {
    throw new Error("private_health is not available to generic Lisa job readers");
  }
}

export function assertCycleIdentity(value: unknown): asserts value is LisaCycleIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Lisa cycle identity must be an object");
  }
  const identity = value as Partial<LisaCycleIdentity>;
  assertLisaJobId(identity.jobId);
  assertLisaLocalDate(identity.localDate);
  assertSafeIdentifier(identity.cycleId, "cycleId");
}

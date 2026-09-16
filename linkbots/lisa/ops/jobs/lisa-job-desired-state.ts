/**
 * Canonical, deployable Lisa job declarations.
 *
 * This file is source authority only. It describes the 19 stable OpenClaw
 * declarations and the separately registered Memory Dreaming dependency; it
 * never creates, edits, enables, or removes a live cron row.
 */
import { createHash } from "node:crypto";
import { LISA_JOB_TIME_ZONE, type LisaJobId, type LisaPrivacyClass } from "./lisa-job-contracts.ts";

export const LISA_DESIRED_STATE_VERSION = 1 as const;
export const LISA_DESIRED_STATE_OWNER = "main" as const;
export const LISA_DESIRED_STATE_EXECUTOR = "lisa-cron" as const;
export const LISA_DESIRED_STATE_DECLARATION_COUNT = 19 as const;

export type LisaDesiredSchedule = Readonly<{
  kind: "cron" | "heartbeat" | "hook";
  expression: string | null;
  localTime: string;
  timeZone: typeof LISA_JOB_TIME_ZONE;
}>;

export type LisaDesiredDelivery = Readonly<{
  mode: "announce" | "email" | "none";
  channel: "telegram" | "email" | null;
  destinationBindingId: string | null;
}>;

export type LisaDesiredDeclaration = Readonly<{
  declarationKey: string;
  instanceIdentity: string;
  family: LisaJobId;
  label: string;
  activation: Readonly<{ enabled: false; deliveryMode: "none" }>;
  schedule: LisaDesiredSchedule;
  preparationTrigger: string;
  visibleDeadlineLocalTime: string | null;
  completionDeadlineLocalTime: string;
  privacyClass: LisaPrivacyClass;
  owner: typeof LISA_DESIRED_STATE_OWNER;
  executor: typeof LISA_DESIRED_STATE_EXECUTOR;
  delivery: LisaDesiredDelivery;
  providerBindings: readonly string[];
  skillSchemaRef: string;
  tools: readonly string[];
  dependencies: readonly string[];
  timeoutSeconds: number;
  idempotencyKey: string;
  retryFailurePolicy: Readonly<{
    maxAttempts: 2;
    retryable: readonly string[];
    terminalFailure: "receipt_required";
  }>;
  receiptRequirements: readonly string[];
  templateRef: string;
}>;

export type LisaExternalMaintenanceDependency = Readonly<{
  id: "memory-dreaming";
  owner: "librarian-provider";
  executor: "provider";
  registration: "separate-openclaw-item";
  cronDeclaration: null;
  dependencies: readonly ["librarian-provider"];
}>;

export type LisaJobDesiredState = Readonly<{
  version: typeof LISA_DESIRED_STATE_VERSION;
  timeZone: typeof LISA_JOB_TIME_ZONE;
  owner: typeof LISA_DESIRED_STATE_OWNER;
  executor: typeof LISA_DESIRED_STATE_EXECUTOR;
  sourceStatus: "SOURCE_READY_SCHEDULES_DISABLED";
  declarations: readonly LisaDesiredDeclaration[];
  externalMaintenance: LisaExternalMaintenanceDependency;
  excludedCronFamilies: readonly ["librarian", "backup"];
}>;

const RETRYABLE_FAILURES = ["timeout", "rate_limited", "unavailable"] as const;

function idempotencyKey(declarationKey: string, instanceIdentity: string): string {
  return createHash("sha256")
    .update(
      `lisa-job-desired-state-v${LISA_DESIRED_STATE_VERSION}|${declarationKey}|${instanceIdentity}`,
    )
    .digest("hex");
}

function declaration(
  input: Omit<
    LisaDesiredDeclaration,
    "instanceIdentity" | "activation" | "idempotencyKey" | "retryFailurePolicy"
  >,
): LisaDesiredDeclaration {
  const instanceIdentity = `lisa:${input.declarationKey}`;
  return Object.freeze({
    ...input,
    instanceIdentity,
    activation: Object.freeze({ enabled: false, deliveryMode: "none" as const }),
    idempotencyKey: idempotencyKey(input.declarationKey, instanceIdentity),
    retryFailurePolicy: Object.freeze({
      maxAttempts: 2 as const,
      retryable: RETRYABLE_FAILURES,
      terminalFailure: "receipt_required" as const,
    }),
    schedule: Object.freeze({ ...input.schedule, timeZone: LISA_JOB_TIME_ZONE }),
    delivery: Object.freeze({ ...input.delivery }),
  });
}

const telegram = (
  destinationBindingId: string | null = "lisa-telegram-binding",
): LisaDesiredDelivery => ({
  mode: "announce",
  channel: "telegram",
  destinationBindingId,
});

const email = (destinationBindingId: string): LisaDesiredDelivery => ({
  mode: "email",
  channel: "email",
  destinationBindingId,
});

const workTools = ["report.read_verified_inputs", "report.render"] as const;
const complianceTools = [
  "compliance.read_state",
  "compliance.write_state",
  "compliance.render",
] as const;
const healthTools = [
  "health.read_private_ledger",
  "health.write_private_ledger",
  "health.render_private",
] as const;

const declarations: readonly LisaDesiredDeclaration[] = [
  declaration({
    declarationKey: "lisa-battery-evaluation-hourly-v1",
    family: "battery_alert_35",
    label: "Hourly battery evaluation",
    schedule: {
      kind: "heartbeat",
      expression: "@hourly",
      localTime: "hourly",
      timeZone: LISA_JOB_TIME_ZONE,
    },
    preparationTrigger: "hourly heartbeat; emit only when a fresh 35% alert is due",
    visibleDeadlineLocalTime: null,
    completionDeadlineLocalTime: "hourly",
    privacyClass: "personal_compliance",
    owner: LISA_DESIRED_STATE_OWNER,
    executor: LISA_DESIRED_STATE_EXECUTOR,
    delivery: telegram(),
    providerBindings: ["personal-compliance-binding"],
    skillSchemaRef: "lisa-compliance-v1",
    tools: ["compliance.read_battery_state"],
    dependencies: [],
    timeoutSeconds: 120,
    receiptRequirements: ["idempotency", "provider-receipt-on-alert", "no-reply-when-not-due"],
    templateRef: "ops/jobs/compliance/templates/battery-35-alert.md",
  }),
  declaration({
    declarationKey: "lisa-time-management-monthly-work-v1",
    family: "time_management",
    label: "Monthly work report",
    schedule: {
      kind: "hook",
      expression: null,
      localTime: "last planned workday 16:45",
      timeZone: LISA_JOB_TIME_ZONE,
    },
    preparationTrigger: "last planned workday at 16:30",
    visibleDeadlineLocalTime: "16:45",
    completionDeadlineLocalTime: "16:45",
    privacyClass: "work",
    owner: LISA_DESIRED_STATE_OWNER,
    executor: LISA_DESIRED_STATE_EXECUTOR,
    delivery: email("carlos-work-email-binding"),
    providerBindings: ["time-management-binding"],
    skillSchemaRef: "lisa-time-management-v1",
    tools: ["time.read_safe_capacity", "time.render"],
    dependencies: [],
    timeoutSeconds: 600,
    receiptRequirements: ["idempotency", "email-receipt"],
    templateRef: "ops/jobs/time-management/templates/monthly-work-report.md",
  }),
  declaration({
    declarationKey: "lisa-executive-digest-evening-v1",
    family: "executive_digest",
    label: "Executive Digest evening",
    schedule: {
      kind: "cron",
      expression: "45 16 * * *",
      localTime: "17:00",
      timeZone: LISA_JOB_TIME_ZONE,
    },
    preparationTrigger: "16:45 Asia/Taipei",
    visibleDeadlineLocalTime: "17:00",
    completionDeadlineLocalTime: "17:00",
    privacyClass: "work",
    owner: LISA_DESIRED_STATE_OWNER,
    executor: LISA_DESIRED_STATE_EXECUTOR,
    delivery: telegram("lisa-telegram-binding"),
    providerBindings: ["operational-reporting-binding"],
    skillSchemaRef: "lisa-reporting-v1",
    tools: workTools,
    dependencies: [],
    timeoutSeconds: 600,
    receiptRequirements: ["telegram-announce-receipt", "email-receipt-on-failure", "idempotency"],
    templateRef: "ops/jobs/reporting/templates/executive-digest.md",
  }),
  declaration({
    declarationKey: "lisa-selfie-1745-v1",
    family: "selfie",
    label: "Selfie and battery checkpoint",
    schedule: {
      kind: "cron",
      expression: "40 17 * * *",
      localTime: "17:45",
      timeZone: LISA_JOB_TIME_ZONE,
    },
    preparationTrigger: "17:40 Asia/Taipei",
    visibleDeadlineLocalTime: "17:45",
    completionDeadlineLocalTime: "23:59",
    privacyClass: "personal_compliance",
    owner: LISA_DESIRED_STATE_OWNER,
    executor: LISA_DESIRED_STATE_EXECUTOR,
    delivery: telegram(),
    providerBindings: ["personal-compliance-binding"],
    skillSchemaRef: "lisa-compliance-v1",
    tools: complianceTools,
    dependencies: [],
    timeoutSeconds: 300,
    receiptRequirements: ["telegram-announce-receipt", "idempotency"],
    templateRef: "ops/jobs/compliance/templates/combined-1745.md",
  }),
  declaration({
    declarationKey: "lisa-flash-2045-v1",
    family: "flash_report",
    label: "Flash Report 20:45",
    schedule: {
      kind: "cron",
      expression: "40 20 * * *",
      localTime: "20:45",
      timeZone: LISA_JOB_TIME_ZONE,
    },
    preparationTrigger: "20:40 Asia/Taipei",
    visibleDeadlineLocalTime: "20:45",
    completionDeadlineLocalTime: "20:45",
    privacyClass: "work",
    owner: LISA_DESIRED_STATE_OWNER,
    executor: LISA_DESIRED_STATE_EXECUTOR,
    delivery: telegram(),
    providerBindings: ["operational-reporting-binding", "personal-compliance-binding"],
    skillSchemaRef: "lisa-reporting-v1",
    tools: workTools,
    dependencies: ["lisa-selfie-2145-v1"],
    timeoutSeconds: 600,
    receiptRequirements: [
      "telegram-announce-receipt",
      "idempotency",
      "no-duplicate-selfie-reminder",
    ],
    templateRef: "ops/jobs/reporting/templates/flash-report.md",
  }),
  declaration({
    declarationKey: "lisa-selfie-2145-v1",
    family: "selfie",
    label: "Conditional selfie reminder",
    schedule: {
      kind: "cron",
      expression: "40 21 * * *",
      localTime: "21:45",
      timeZone: LISA_JOB_TIME_ZONE,
    },
    preparationTrigger: "21:40 Asia/Taipei",
    visibleDeadlineLocalTime: "21:45",
    completionDeadlineLocalTime: "23:59",
    privacyClass: "personal_compliance",
    owner: LISA_DESIRED_STATE_OWNER,
    executor: LISA_DESIRED_STATE_EXECUTOR,
    delivery: telegram(),
    providerBindings: ["personal-compliance-binding"],
    skillSchemaRef: "lisa-compliance-v1",
    tools: complianceTools,
    dependencies: [],
    timeoutSeconds: 300,
    receiptRequirements: ["telegram-announce-receipt-or-no-reply", "idempotency", "late-status"],
    templateRef: "ops/jobs/compliance/templates/conditional-2145.md",
  }),
  declaration({
    declarationKey: "lisa-private-health-2245-v1",
    family: "private_health",
    label: "Private health evening checkpoint",
    schedule: {
      kind: "cron",
      expression: "40 22 * * *",
      localTime: "22:45",
      timeZone: LISA_JOB_TIME_ZONE,
    },
    preparationTrigger: "22:40 Asia/Taipei",
    visibleDeadlineLocalTime: "22:45",
    completionDeadlineLocalTime: "22:45",
    privacyClass: "private_health",
    owner: LISA_DESIRED_STATE_OWNER,
    executor: LISA_DESIRED_STATE_EXECUTOR,
    delivery: telegram(),
    providerBindings: ["private-health-binding"],
    skillSchemaRef: "lisa-private-health-v1",
    tools: healthTools,
    dependencies: [],
    timeoutSeconds: 600,
    receiptRequirements: ["telegram-announce-receipt", "private-ledger-write", "idempotency"],
    templateRef: "ops/jobs/health/templates/check-in.md",
  }),
  declaration({
    declarationKey: "lisa-flash-2245-v1",
    family: "flash_report",
    label: "Flash Report 22:45",
    schedule: {
      kind: "cron",
      expression: "40 22 * * *",
      localTime: "22:45",
      timeZone: LISA_JOB_TIME_ZONE,
    },
    preparationTrigger: "22:40 Asia/Taipei",
    visibleDeadlineLocalTime: "22:45",
    completionDeadlineLocalTime: "22:45",
    privacyClass: "work",
    owner: LISA_DESIRED_STATE_OWNER,
    executor: LISA_DESIRED_STATE_EXECUTOR,
    delivery: telegram(),
    providerBindings: ["operational-reporting-binding", "personal-compliance-binding"],
    skillSchemaRef: "lisa-reporting-v1",
    tools: workTools,
    dependencies: ["lisa-private-health-2245-v1"],
    timeoutSeconds: 600,
    receiptRequirements: ["telegram-announce-receipt", "idempotency", "final-battery-point"],
    templateRef: "ops/jobs/reporting/templates/flash-report.md",
  }),
  declaration({
    declarationKey: "lisa-private-health-drive-export-v1",
    family: "private_health",
    label: "Private health encrypted Drive export",
    schedule: {
      kind: "hook",
      expression: null,
      localTime: "after nightly ledger write",
      timeZone: LISA_JOB_TIME_ZONE,
    },
    preparationTrigger: "after lisa-private-health-2245-v1 succeeds",
    visibleDeadlineLocalTime: null,
    completionDeadlineLocalTime: "23:59",
    privacyClass: "private_health",
    owner: LISA_DESIRED_STATE_OWNER,
    executor: LISA_DESIRED_STATE_EXECUTOR,
    delivery: email("carlos-personal-email-binding"),
    providerBindings: ["private-health-binding"],
    skillSchemaRef: "lisa-private-health-v1",
    tools: ["health.export_encrypted", "health.verify_export"],
    dependencies: ["lisa-private-health-2245-v1"],
    timeoutSeconds: 900,
    receiptRequirements: ["encrypted-export-receipt", "restore-manifest-receipt", "idempotency"],
    templateRef: "ops/jobs/health/templates/export-plan.md",
  }),
  declaration({
    declarationKey: "lisa-midnight-finalizer-v1",
    family: "selfie",
    label: "Selfie midnight finalizer",
    schedule: {
      kind: "cron",
      expression: "59 23 * * *",
      localTime: "23:59",
      timeZone: LISA_JOB_TIME_ZONE,
    },
    preparationTrigger: "23:50 Asia/Taipei",
    visibleDeadlineLocalTime: null,
    completionDeadlineLocalTime: "23:59",
    privacyClass: "personal_compliance",
    owner: LISA_DESIRED_STATE_OWNER,
    executor: LISA_DESIRED_STATE_EXECUTOR,
    delivery: telegram(null),
    providerBindings: ["personal-compliance-binding"],
    skillSchemaRef: "lisa-compliance-v1",
    tools: ["compliance.read_state", "compliance.finalize_day"],
    dependencies: ["lisa-selfie-2145-v1"],
    timeoutSeconds: 300,
    receiptRequirements: ["idempotency", "private-compliance-final-state"],
    templateRef: "ops/jobs/compliance/templates/selfie-acknowledgment.md",
  }),
  declaration({
    declarationKey: "lisa-executive-digest-morning-v1",
    family: "executive_digest",
    label: "Executive Digest morning",
    schedule: {
      kind: "cron",
      expression: "45 6 * * *",
      localTime: "07:00",
      timeZone: LISA_JOB_TIME_ZONE,
    },
    preparationTrigger: "06:45 Asia/Taipei",
    visibleDeadlineLocalTime: "07:00",
    completionDeadlineLocalTime: "07:00",
    privacyClass: "work",
    owner: LISA_DESIRED_STATE_OWNER,
    executor: LISA_DESIRED_STATE_EXECUTOR,
    delivery: telegram("lisa-telegram-binding"),
    providerBindings: ["operational-reporting-binding"],
    skillSchemaRef: "lisa-reporting-v1",
    tools: workTools,
    dependencies: ["memory-dreaming"],
    timeoutSeconds: 600,
    receiptRequirements: ["telegram-announce-receipt", "email-receipt-on-failure", "idempotency"],
    templateRef: "ops/jobs/reporting/templates/executive-digest.md",
  }),
  declaration({
    declarationKey: "lisa-private-health-0815-v1",
    family: "private_health",
    label: "Private health morning checkpoint",
    schedule: {
      kind: "cron",
      expression: "10 8 * * *",
      localTime: "08:15",
      timeZone: LISA_JOB_TIME_ZONE,
    },
    preparationTrigger: "08:10 Asia/Taipei",
    visibleDeadlineLocalTime: "08:15",
    completionDeadlineLocalTime: "08:15",
    privacyClass: "private_health",
    owner: LISA_DESIRED_STATE_OWNER,
    executor: LISA_DESIRED_STATE_EXECUTOR,
    delivery: telegram(),
    providerBindings: ["private-health-binding"],
    skillSchemaRef: "lisa-private-health-v1",
    tools: healthTools,
    dependencies: [],
    timeoutSeconds: 600,
    receiptRequirements: ["telegram-announce-receipt", "private-ledger-write", "idempotency"],
    templateRef: "ops/jobs/health/templates/check-in.md",
  }),
  declaration({
    declarationKey: "lisa-flash-1045-v1",
    family: "flash_report",
    label: "Flash Report 10:45",
    schedule: {
      kind: "cron",
      expression: "40 10 * * *",
      localTime: "10:45",
      timeZone: LISA_JOB_TIME_ZONE,
    },
    preparationTrigger: "10:40 Asia/Taipei",
    visibleDeadlineLocalTime: "10:45",
    completionDeadlineLocalTime: "10:45",
    privacyClass: "work",
    owner: LISA_DESIRED_STATE_OWNER,
    executor: LISA_DESIRED_STATE_EXECUTOR,
    delivery: telegram(),
    providerBindings: ["operational-reporting-binding", "personal-compliance-binding"],
    skillSchemaRef: "lisa-reporting-v1",
    tools: workTools,
    dependencies: [],
    timeoutSeconds: 600,
    receiptRequirements: ["telegram-announce-receipt", "idempotency", "battery-status"],
    templateRef: "ops/jobs/reporting/templates/flash-report.md",
  }),
  declaration({
    declarationKey: "lisa-flash-1245-v1",
    family: "flash_report",
    label: "Flash Report 12:45",
    schedule: {
      kind: "cron",
      expression: "40 12 * * *",
      localTime: "12:45",
      timeZone: LISA_JOB_TIME_ZONE,
    },
    preparationTrigger: "12:40 Asia/Taipei",
    visibleDeadlineLocalTime: "12:45",
    completionDeadlineLocalTime: "12:45",
    privacyClass: "work",
    owner: LISA_DESIRED_STATE_OWNER,
    executor: LISA_DESIRED_STATE_EXECUTOR,
    delivery: telegram(),
    providerBindings: ["operational-reporting-binding", "personal-compliance-binding"],
    skillSchemaRef: "lisa-reporting-v1",
    tools: workTools,
    dependencies: [],
    timeoutSeconds: 600,
    receiptRequirements: ["telegram-announce-receipt", "idempotency", "battery-status"],
    templateRef: "ops/jobs/reporting/templates/flash-report.md",
  }),
  declaration({
    declarationKey: "lisa-private-health-1315-v1",
    family: "private_health",
    label: "Private health midday checkpoint",
    schedule: {
      kind: "cron",
      expression: "10 13 * * *",
      localTime: "13:15",
      timeZone: LISA_JOB_TIME_ZONE,
    },
    preparationTrigger: "13:10 Asia/Taipei",
    visibleDeadlineLocalTime: "13:15",
    completionDeadlineLocalTime: "13:15",
    privacyClass: "private_health",
    owner: LISA_DESIRED_STATE_OWNER,
    executor: LISA_DESIRED_STATE_EXECUTOR,
    delivery: telegram(),
    providerBindings: ["private-health-binding"],
    skillSchemaRef: "lisa-private-health-v1",
    tools: healthTools,
    dependencies: [],
    timeoutSeconds: 600,
    receiptRequirements: ["telegram-announce-receipt", "private-ledger-write", "idempotency"],
    templateRef: "ops/jobs/health/templates/check-in.md",
  }),
  declaration({
    declarationKey: "lisa-flash-1445-v1",
    family: "flash_report",
    label: "Flash Report 14:45",
    schedule: {
      kind: "cron",
      expression: "40 14 * * *",
      localTime: "14:45",
      timeZone: LISA_JOB_TIME_ZONE,
    },
    preparationTrigger: "14:40 Asia/Taipei",
    visibleDeadlineLocalTime: "14:45",
    completionDeadlineLocalTime: "14:45",
    privacyClass: "work",
    owner: LISA_DESIRED_STATE_OWNER,
    executor: LISA_DESIRED_STATE_EXECUTOR,
    delivery: telegram(),
    providerBindings: ["operational-reporting-binding", "personal-compliance-binding"],
    skillSchemaRef: "lisa-reporting-v1",
    tools: workTools,
    dependencies: [],
    timeoutSeconds: 600,
    receiptRequirements: ["telegram-announce-receipt", "idempotency", "flexible-period-decision"],
    templateRef: "ops/jobs/reporting/templates/flash-report.md",
  }),
  declaration({
    declarationKey: "lisa-time-management-weekly-plan-v1",
    family: "time_management",
    label: "Weekly plan",
    schedule: {
      kind: "hook",
      expression: null,
      localTime: "Monday 07:45",
      timeZone: LISA_JOB_TIME_ZONE,
    },
    preparationTrigger: "Monday 07:30 Asia/Taipei",
    visibleDeadlineLocalTime: "07:45",
    completionDeadlineLocalTime: "07:45",
    privacyClass: "work",
    owner: LISA_DESIRED_STATE_OWNER,
    executor: LISA_DESIRED_STATE_EXECUTOR,
    delivery: email("carlos-work-email-binding"),
    providerBindings: ["time-management-binding"],
    skillSchemaRef: "lisa-time-management-v1",
    tools: ["time.read_safe_capacity", "time.render"],
    dependencies: [],
    timeoutSeconds: 600,
    receiptRequirements: ["email-receipt", "idempotency"],
    templateRef: "ops/jobs/time-management/templates/weekly-plan.md",
  }),
  declaration({
    declarationKey: "lisa-private-health-reassessment-v1",
    family: "private_health",
    label: "Private health monthly reassessment",
    schedule: {
      kind: "hook",
      expression: null,
      localTime: "first day monthly",
      timeZone: LISA_JOB_TIME_ZONE,
    },
    preparationTrigger: "first day monthly at 07:45 Asia/Taipei",
    visibleDeadlineLocalTime: null,
    completionDeadlineLocalTime: "08:00",
    privacyClass: "private_health",
    owner: LISA_DESIRED_STATE_OWNER,
    executor: LISA_DESIRED_STATE_EXECUTOR,
    delivery: email("carlos-personal-email-binding"),
    providerBindings: ["private-health-binding"],
    skillSchemaRef: "lisa-private-health-v1",
    tools: healthTools,
    dependencies: [],
    timeoutSeconds: 900,
    receiptRequirements: ["private-ledger-write", "idempotency"],
    templateRef: "ops/jobs/health/templates/appointment-follow-up.md",
  }),
  declaration({
    declarationKey: "lisa-private-health-monthly-report-v1",
    family: "private_health",
    label: "Private health monthly report",
    schedule: {
      kind: "hook",
      expression: null,
      localTime: "first day monthly 08:00",
      timeZone: LISA_JOB_TIME_ZONE,
    },
    preparationTrigger: "first day monthly at 07:45 Asia/Taipei",
    visibleDeadlineLocalTime: "08:00",
    completionDeadlineLocalTime: "08:00",
    privacyClass: "private_health",
    owner: LISA_DESIRED_STATE_OWNER,
    executor: LISA_DESIRED_STATE_EXECUTOR,
    delivery: email("carlos-personal-email-binding"),
    providerBindings: ["private-health-binding"],
    skillSchemaRef: "lisa-private-health-v1",
    tools: healthTools,
    dependencies: ["lisa-private-health-reassessment-v1"],
    timeoutSeconds: 900,
    receiptRequirements: ["encrypted-report-receipt", "email-receipt", "idempotency"],
    templateRef: "ops/jobs/health/templates/monthly-report.md",
  }),
];

export const LISA_JOB_DESIRED_STATE: LisaJobDesiredState = Object.freeze({
  version: LISA_DESIRED_STATE_VERSION,
  timeZone: LISA_JOB_TIME_ZONE,
  owner: LISA_DESIRED_STATE_OWNER,
  executor: LISA_DESIRED_STATE_EXECUTOR,
  sourceStatus: "SOURCE_READY_SCHEDULES_DISABLED",
  declarations,
  externalMaintenance: Object.freeze({
    id: "memory-dreaming",
    owner: "librarian-provider",
    executor: "provider",
    registration: "separate-openclaw-item",
    cronDeclaration: null,
    dependencies: ["librarian-provider"],
  }),
  excludedCronFamilies: ["librarian", "backup"],
});

export const LISA_DESIRED_DECLARATION_KEYS = Object.freeze(
  LISA_JOB_DESIRED_STATE.declarations.map((item) => item.declarationKey),
);

export type LisaLiveDeclarationSnapshot = Readonly<{
  declarationKey: string;
  instanceIdentity?: string;
  scheduleExpression: string | null;
  scheduleTimeZone: string;
  owner: string;
  executor: string;
  deliveryMode: string;
  deliveryChannel: string | null;
  enabled: boolean;
}>;

export type LisaDesiredStateDiff = Readonly<{
  missing: readonly string[];
  unexpected: readonly string[];
  drifted: readonly string[];
  applyAuthorizationHold: readonly string[];
  ok: boolean;
}>;

export function validateLisaJobDesiredState(
  desired: LisaJobDesiredState = LISA_JOB_DESIRED_STATE,
): string[] {
  const errors: string[] = [];
  if (desired.version !== LISA_DESIRED_STATE_VERSION) errors.push("desired-state version mismatch");
  if (desired.timeZone !== LISA_JOB_TIME_ZONE) errors.push("desired-state timezone mismatch");
  if (desired.owner !== "main") errors.push("desired-state owner must be main");
  if (desired.executor !== "lisa-cron") errors.push("desired-state executor must be lisa-cron");
  if (desired.declarations.length !== LISA_DESIRED_STATE_DECLARATION_COUNT) {
    errors.push(`expected ${LISA_DESIRED_STATE_DECLARATION_COUNT} operational declarations`);
  }
  const keys = new Set<string>();
  for (const item of desired.declarations) {
    if (keys.has(item.declarationKey))
      errors.push(`${item.declarationKey}: duplicate declaration key`);
    keys.add(item.declarationKey);
    if (item.instanceIdentity !== `lisa:${item.declarationKey}`)
      errors.push(`${item.declarationKey}: unstable instance identity`);
    if (item.activation.enabled !== false || item.activation.deliveryMode !== "none")
      errors.push(`${item.declarationKey}: source activation must remain disabled`);
    if (item.schedule.timeZone !== LISA_JOB_TIME_ZONE)
      errors.push(`${item.declarationKey}: timezone mismatch`);
    if (item.owner !== "main" || item.executor !== "lisa-cron")
      errors.push(`${item.declarationKey}: owner/executor mismatch`);
    if (item.delivery.mode === "none" || item.delivery.channel === null)
      errors.push(`${item.declarationKey}: delivery intent is incomplete`);
    if (
      item.delivery.destinationBindingId !== null &&
      !/^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u.test(item.delivery.destinationBindingId)
    )
      errors.push(`${item.declarationKey}: invalid destination binding`);
    if (!/^[a-f0-9]{64}$/u.test(item.idempotencyKey))
      errors.push(`${item.declarationKey}: invalid idempotency key`);
    if (item.retryFailurePolicy.maxAttempts !== 2)
      errors.push(`${item.declarationKey}: retry bound must be two attempts`);
    if (item.timeoutSeconds <= 0 || item.timeoutSeconds > 1_800)
      errors.push(`${item.declarationKey}: invalid timeout`);
    if (item.receiptRequirements.length === 0)
      errors.push(`${item.declarationKey}: receipt requirement missing`);
  }
  if (desired.externalMaintenance.cronDeclaration !== null)
    errors.push("Memory Dreaming must not be a cron declaration");
  if (desired.excludedCronFamilies.join(",") !== "librarian,backup")
    errors.push("Librarian and backup must remain excluded cron families");
  return errors;
}

export function assertValidLisaJobDesiredState(
  desired: LisaJobDesiredState = LISA_JOB_DESIRED_STATE,
): void {
  const errors = validateLisaJobDesiredState(desired);
  if (errors.length > 0) throw new Error(`invalid Lisa job desired state: ${errors.join("; ")}`);
}

/** Compare a read-only live export with source desired state; never mutates it. */
export function diffLisaJobDesiredState(
  live: readonly LisaLiveDeclarationSnapshot[],
  desired: LisaJobDesiredState = LISA_JOB_DESIRED_STATE,
): LisaDesiredStateDiff {
  assertValidLisaJobDesiredState(desired);
  const expected = new Map(desired.declarations.map((item) => [item.declarationKey, item]));
  const actual = new Map(live.map((item) => [item.declarationKey, item]));
  const missing = [...expected.keys()].filter((key) => !actual.has(key)).toSorted();
  const unexpected = [...actual.keys()].filter((key) => !expected.has(key)).toSorted();
  const drifted = [...expected.keys()]
    .filter((key) => {
      const wanted = expected.get(key)!;
      const observed = actual.get(key);
      if (!observed) return false;
      return (
        observed.instanceIdentity !== wanted.instanceIdentity ||
        observed.scheduleExpression !== wanted.schedule.expression ||
        observed.scheduleTimeZone !== wanted.schedule.timeZone ||
        observed.owner !== wanted.owner ||
        observed.executor !== wanted.executor ||
        observed.deliveryMode !== wanted.delivery.mode ||
        observed.deliveryChannel !== wanted.delivery.channel
      );
    })
    .toSorted();
  // Source stays disabled until a separate apply authority exists. Live
  // enabled=true is an apply HOLD, not schedule drift, and this helper never
  // mutates cron.
  const applyAuthorizationHold = [...expected.keys()]
    .filter((key) => {
      const observed = actual.get(key);
      return Boolean(observed?.enabled) && !drifted.includes(key);
    })
    .toSorted();
  return {
    missing,
    unexpected,
    drifted,
    applyAuthorizationHold,
    ok: missing.length === 0 && unexpected.length === 0 && drifted.length === 0,
  };
}

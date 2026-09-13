/**
 * Lisa's source-only ten-family catalogue.
 *
 * This is a family-level source inventory, not an activation mechanism. Every
 * entry is disabled and delivery-free. The deployable 19-declaration desired
 * state lives in lisa-job-desired-state.ts; keeping the two layers separate
 * prevents Librarian and systemd-owned backup from becoming cron jobs.
 */
import { createHash } from "node:crypto";
import {
  LISA_OCP01_PIN_IDENTITIES,
  LISA_WAVE_A_HOLD_RELEASE_REF,
  toLisaCatalogueContractRef,
} from "../providers/pin-identities.ts";
import {
  LISA_JOB_IDS,
  LISA_JOB_SCHEDULE_METADATA,
  LISA_JOB_TIME_ZONE,
  assertLisaJobId,
  assertLisaScheduleMetadata,
  assertProviderReceiptReference,
  assertDestinationBindingId,
  assertSafeIdentifier,
  type LisaJobId,
  type LisaPrivacyClass,
} from "./lisa-job-contracts.ts";
import {
  DIGEST_PREPARATION_DEADLINES,
  FLASH_DEADLINES,
  FLASH_PREPARATION_DEADLINES,
} from "./reporting/reporting-contracts.ts";

export const LISA_CATALOGUE_VERSION = 1 as const;
export const LISA_CATALOGUE_DELIVERY_MODE = "none" as const;
export const LISA_CATALOGUE_SOURCE_STATUS = "SOURCE_ONLY" as const;

export const LISA_CATALOGUE_HARD_STOPS = [
  "source-only: never activate schedules from this catalogue",
  "delivery.mode=none: never announce through Telegram or email",
  "never contact live Lisa, the VPS, or the Mac Mini",
  "never mutate Google, Telegram, email, GSM, LiNKbrain, or any provider",
  "never read or include real private data, credentials, tokens, addresses, or destination IDs",
  "missing provider release or credential binding is an explicit HOLD; never use a fallback",
] as const;

export type LisaCatalogueProviderDependency = Readonly<{
  providerId: string;
  releaseRef: string;
  contractRef: string;
  credentialBindingId: string;
}>;

export type LisaCatalogueSchedule = Readonly<{
  timeZone: typeof LISA_JOB_TIME_ZONE;
  kind: "cron" | "heartbeat" | "embedded" | "conditional" | "finalizer" | "hook";
  localTimes: readonly string[];
  cron?: string;
  embeddedIn?: readonly string[];
}>;

export type LisaCatalogueDeadlines = Readonly<{
  preparationDeadlineLocalTime: string;
  visibleDeliveryDeadlineLocalTime: string | null;
  completionDeadlineLocalTime: string;
}>;

export type LisaCatalogueEntry = Readonly<{
  id: string;
  family: LisaJobId;
  label: string;
  enabled: false;
  privacyClass: LisaPrivacyClass;
  schedule: LisaCatalogueSchedule;
  deadlines: LisaCatalogueDeadlines;
  delivery: Readonly<{ mode: typeof LISA_CATALOGUE_DELIVERY_MODE }>;
  tools: readonly string[];
  providerDependencies: readonly LisaCatalogueProviderDependency[];
  destinationBindingId: string | null;
  timeoutSeconds: number;
  idempotencyKey: string;
  hardStops: readonly string[];
  sourceProcedure: string;
}>;

export type LisaJobCatalogue = Readonly<{
  catalogueVersion: typeof LISA_CATALOGUE_VERSION;
  sourceStatus: typeof LISA_CATALOGUE_SOURCE_STATUS;
  timezone: typeof LISA_JOB_TIME_ZONE;
  deliveryMode: typeof LISA_CATALOGUE_DELIVERY_MODE;
  families: readonly LisaJobId[];
  entries: readonly LisaCatalogueEntry[];
  hardStops: readonly string[];
}>;

export type LisaProviderBinding = Readonly<{
  releaseRef: string;
  contractRef: string;
  credentialBindingId: string;
}>;

export type LisaCatalogueProviderDecision = Readonly<{
  status: "HOLD" | "SOURCE_READY_SCHEDULES_DISABLED";
  missing: readonly string[];
  reason: string;
}>;

const PROVIDER = {
  librarian: {
    providerId: LISA_OCP01_PIN_IDENTITIES.brain.repository,
    releaseRef: LISA_OCP01_PIN_IDENTITIES.brain.commit,
    contractRef: toLisaCatalogueContractRef(LISA_OCP01_PIN_IDENTITIES.brain.contractRef),
    credentialBindingId: "ocp-01-brain-binding-hold",
  },
  dreaming: {
    providerId: "memory-dreaming",
    releaseRef: LISA_WAVE_A_HOLD_RELEASE_REF,
    contractRef: "dreaming-receipt-v1",
    credentialBindingId: "memory-dreaming-binding",
  },
  backup: {
    providerId: "backup-adapter",
    releaseRef: LISA_WAVE_A_HOLD_RELEASE_REF,
    contractRef: "encrypted-backup-v1",
    credentialBindingId: "backup-adapter-binding",
  },
  reporting: {
    providerId: "operational-reporting",
    releaseRef: "source-contract-wp02",
    contractRef: "reporting-v1",
    credentialBindingId: "operational-reporting-binding",
  },
  compliance: {
    providerId: "personal-compliance",
    releaseRef: "source-contract-wp03",
    contractRef: "compliance-v1",
    credentialBindingId: "personal-compliance-binding",
  },
  time: {
    providerId: "time-management",
    releaseRef: "source-contract-wp05",
    contractRef: "time-management-v1",
    credentialBindingId: "time-management-binding",
  },
  health: {
    providerId: "private-health-management",
    releaseRef: "source-contract-wp06",
    contractRef: "private-health-v1",
    credentialBindingId: "private-health-binding",
  },
} as const;

const TOOLS = {
  readOnly: ["compliance.read_battery_state"] as const,
  maintenance: [
    "maintenance.read_receipts",
    "maintenance.write_local_state",
    "maintenance.run_bounded_adapter",
  ] as const,
  report: ["report.read_verified_inputs", "report.render"] as const,
  compliance: ["compliance.read_state", "compliance.write_state", "compliance.render"] as const,
  time: ["time.read_safe_capacity", "time.render"] as const,
  privateHealth: [
    "health.read_private_ledger",
    "health.write_private_ledger",
    "health.render_private",
  ] as const,
};

function idempotencyKey(family: LisaJobId, entryId: string): string {
  return createHash("sha256")
    .update(`lisa-catalogue-v${LISA_CATALOGUE_VERSION}|${family}|${entryId}|local-date`)
    .digest("hex");
}

export function deriveLisaJobIdempotencyKey(family: LisaJobId, entryId: string): string {
  assertLisaJobId(family);
  assertSafeIdentifier(entryId, "entryId");
  return idempotencyKey(family, entryId);
}

function dependency(value: LisaCatalogueProviderDependency): LisaCatalogueProviderDependency {
  assertSafeIdentifier(value.providerId, "providerId");
  assertSafeIdentifier(value.releaseRef, "releaseRef");
  assertSafeIdentifier(value.contractRef, "contractRef");
  assertSafeIdentifier(value.credentialBindingId, "credentialBindingId");
  return Object.freeze({ ...value });
}

function entry(
  input: Omit<
    LisaCatalogueEntry,
    "enabled" | "idempotencyKey" | "hardStops" | "delivery" | "schedule"
  > & {
    schedule: Omit<LisaCatalogueSchedule, "timeZone">;
  },
): LisaCatalogueEntry {
  const result: LisaCatalogueEntry = Object.freeze({
    ...input,
    schedule: Object.freeze({ timeZone: LISA_JOB_TIME_ZONE, ...input.schedule }),
    enabled: false,
    delivery: Object.freeze({ mode: LISA_CATALOGUE_DELIVERY_MODE }),
    idempotencyKey: idempotencyKey(input.family, input.id),
    hardStops: LISA_CATALOGUE_HARD_STOPS,
  });
  return result;
}

const maintenanceDeadline = {
  librarian: {
    preparationDeadlineLocalTime: "03:30",
    visibleDeliveryDeadlineLocalTime: null,
    completionDeadlineLocalTime: "04:30",
  },
  dreaming: {
    preparationDeadlineLocalTime: "04:30",
    visibleDeliveryDeadlineLocalTime: null,
    completionDeadlineLocalTime: "05:30",
  },
  backup: {
    preparationDeadlineLocalTime: "05:30",
    visibleDeliveryDeadlineLocalTime: null,
    completionDeadlineLocalTime: "06:30",
  },
} as const;

function subtractMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const total = hours * 60 + mins - minutes;
  const normalized = (total + 24 * 60) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function digestDeadline(time: keyof typeof DIGEST_PREPARATION_DEADLINES): LisaCatalogueDeadlines {
  return {
    preparationDeadlineLocalTime: DIGEST_PREPARATION_DEADLINES[time],
    visibleDeliveryDeadlineLocalTime: time,
    completionDeadlineLocalTime: time,
  };
}

function flashDeadline(time: keyof typeof FLASH_PREPARATION_DEADLINES): LisaCatalogueDeadlines {
  return {
    preparationDeadlineLocalTime: FLASH_PREPARATION_DEADLINES[time],
    visibleDeliveryDeadlineLocalTime: time,
    completionDeadlineLocalTime: time,
  };
}

function preparationCron(time: string, leadMinutes = 5): string {
  const preparationTime = subtractMinutes(time, leadMinutes);
  const [hours, minutes] = preparationTime.split(":").map(Number);
  return `${minutes} ${hours} * * *`;
}

const entries: readonly LisaCatalogueEntry[] = [
  entry({
    id: "librarian-cycle",
    family: "librarian",
    label: "Librarian cycle",
    privacyClass: "work",
    schedule: { kind: "hook", localTimes: ["03:30"] },
    deadlines: maintenanceDeadline.librarian,
    tools: TOOLS.maintenance,
    providerDependencies: [dependency(PROVIDER.librarian)],
    destinationBindingId: null,
    timeoutSeconds: 1_800,
    sourceProcedure: "jobs/maintenance/procedure.md",
  }),
  entry({
    id: "memory-dreaming-cycle",
    family: "memory_dreaming",
    label: "Memory Dreaming",
    privacyClass: "work",
    schedule: { kind: "hook", localTimes: ["04:30"] },
    deadlines: maintenanceDeadline.dreaming,
    tools: TOOLS.maintenance,
    providerDependencies: [dependency(PROVIDER.dreaming), dependency(PROVIDER.librarian)],
    destinationBindingId: null,
    timeoutSeconds: 1_800,
    sourceProcedure: "jobs/maintenance/procedure.md",
  }),
  entry({
    id: "encrypted-backup-cycle",
    family: "backup",
    label: "Off-VPS encrypted backup",
    privacyClass: "work",
    schedule: { kind: "hook", localTimes: ["05:30"] },
    deadlines: maintenanceDeadline.backup,
    tools: TOOLS.maintenance,
    providerDependencies: [dependency(PROVIDER.backup), dependency(PROVIDER.dreaming)],
    destinationBindingId: "backup-destination-binding",
    timeoutSeconds: 1_800,
    sourceProcedure: "jobs/maintenance/procedure.md",
  }),
  entry({
    id: "executive-digest-morning",
    family: "executive_digest",
    label: "Executive Digest morning",
    privacyClass: "work",
    schedule: { kind: "cron", localTimes: ["07:00"], cron: "45 6 * * *" },
    deadlines: digestDeadline("07:00"),
    tools: TOOLS.report,
    providerDependencies: [dependency(PROVIDER.reporting), dependency(PROVIDER.librarian)],
    destinationBindingId: "lisa-telegram-binding",
    timeoutSeconds: 600,
    sourceProcedure: "jobs/reporting/procedure.md",
  }),
  entry({
    id: "executive-digest-evening",
    family: "executive_digest",
    label: "Executive Digest evening",
    privacyClass: "work",
    schedule: { kind: "cron", localTimes: ["17:00"], cron: "45 16 * * *" },
    deadlines: digestDeadline("17:00"),
    tools: TOOLS.report,
    providerDependencies: [dependency(PROVIDER.reporting)],
    destinationBindingId: "lisa-telegram-binding",
    timeoutSeconds: 600,
    sourceProcedure: "jobs/reporting/procedure.md",
  }),
  ...FLASH_DEADLINES.map((time) =>
    entry({
      id: `flash-report-${time.replace(":", "")}`,
      family: "flash_report",
      label: `Flash Report ${time}`,
      privacyClass: "work",
      schedule: {
        kind: "cron",
        localTimes: [time],
        cron: preparationCron(time),
      },
      deadlines: flashDeadline(time),
      tools: TOOLS.report,
      providerDependencies: [dependency(PROVIDER.reporting), dependency(PROVIDER.compliance)],
      destinationBindingId: "lisa-telegram-binding",
      timeoutSeconds: 600,
      sourceProcedure: "jobs/reporting/procedure.md",
    }),
  ),
  entry({
    id: "selfie-reminder-1745",
    family: "selfie",
    label: "Selfie reminder",
    privacyClass: "personal_compliance",
    schedule: { kind: "cron", localTimes: ["17:45"], cron: "40 17 * * *" },
    deadlines: {
      preparationDeadlineLocalTime: "17:40",
      visibleDeliveryDeadlineLocalTime: "17:45",
      completionDeadlineLocalTime: "23:59",
    },
    tools: TOOLS.compliance,
    providerDependencies: [dependency(PROVIDER.compliance)],
    destinationBindingId: "lisa-telegram-binding",
    timeoutSeconds: 300,
    sourceProcedure: "jobs/compliance/procedure.md",
  }),
  entry({
    id: "selfie-conditional-2145",
    family: "selfie",
    label: "Conditional selfie reminder",
    privacyClass: "personal_compliance",
    schedule: { kind: "cron", localTimes: ["21:45"], cron: "40 21 * * *" },
    deadlines: {
      preparationDeadlineLocalTime: "21:40",
      visibleDeliveryDeadlineLocalTime: "21:45",
      completionDeadlineLocalTime: "23:59",
    },
    tools: TOOLS.compliance,
    providerDependencies: [dependency(PROVIDER.compliance)],
    destinationBindingId: "lisa-telegram-binding",
    timeoutSeconds: 300,
    sourceProcedure: "jobs/compliance/procedure.md",
  }),
  entry({
    id: "selfie-midnight-finalizer",
    family: "selfie",
    label: "Selfie midnight finalizer",
    privacyClass: "personal_compliance",
    schedule: { kind: "finalizer", localTimes: ["23:59"], cron: "59 23 * * *" },
    deadlines: {
      preparationDeadlineLocalTime: "23:50",
      visibleDeliveryDeadlineLocalTime: null,
      completionDeadlineLocalTime: "23:59",
    },
    tools: TOOLS.compliance,
    providerDependencies: [dependency(PROVIDER.compliance)],
    destinationBindingId: null,
    timeoutSeconds: 300,
    sourceProcedure: "jobs/compliance/procedure.md",
  }),
  entry({
    id: "battery-checkpoints-embedded",
    family: "battery_tracking",
    label: "Battery checkpoints embedded in existing messages",
    privacyClass: "personal_compliance",
    schedule: {
      kind: "embedded",
      localTimes: ["08:15", "10:45", "14:45", "17:45", "22:45"],
      embeddedIn: [
        "time-management-daily-hooks",
        "flash-report-1045",
        "flash-report-1445",
        "selfie-reminder-1745",
        "flash-report-2245",
      ],
    },
    deadlines: {
      preparationDeadlineLocalTime: "08:05",
      visibleDeliveryDeadlineLocalTime: "08:15",
      completionDeadlineLocalTime: "22:45",
    },
    tools: TOOLS.compliance,
    providerDependencies: [dependency(PROVIDER.compliance)],
    destinationBindingId: "lisa-telegram-binding",
    timeoutSeconds: 300,
    sourceProcedure: "jobs/compliance/procedure.md",
  }),
  entry({
    id: "battery-heartbeat-hourly",
    family: "battery_alert_35",
    label: "Hourly heartbeat battery evaluation",
    privacyClass: "personal_compliance",
    schedule: { kind: "heartbeat", localTimes: ["hourly"], cron: "@hourly" },
    deadlines: {
      preparationDeadlineLocalTime: "hourly",
      visibleDeliveryDeadlineLocalTime: null,
      completionDeadlineLocalTime: "hourly",
    },
    tools: TOOLS.readOnly,
    providerDependencies: [dependency(PROVIDER.compliance)],
    destinationBindingId: "lisa-telegram-binding",
    timeoutSeconds: 120,
    sourceProcedure: "jobs/compliance/procedure.md",
  }),
  entry({
    id: "time-management-daily-hooks",
    family: "time_management",
    label: "Time Management daily hooks",
    privacyClass: "work",
    schedule: {
      kind: "hook",
      localTimes: ["08:15", "14:45", "17:00"],
      embeddedIn: ["executive-digest-morning", "flash-report-1445", "executive-digest-evening"],
    },
    deadlines: {
      preparationDeadlineLocalTime: "08:05",
      visibleDeliveryDeadlineLocalTime: "08:15",
      completionDeadlineLocalTime: "17:00",
    },
    tools: TOOLS.time,
    providerDependencies: [dependency(PROVIDER.time)],
    destinationBindingId: "carlos-work-email-binding",
    timeoutSeconds: 600,
    sourceProcedure: "jobs/time-management/procedure.md",
  }),
  entry({
    id: "time-management-weekly-plan",
    family: "time_management",
    label: "Time Management weekly plan",
    privacyClass: "work",
    schedule: { kind: "hook", localTimes: ["Monday 07:45"] },
    deadlines: {
      preparationDeadlineLocalTime: "07:30",
      visibleDeliveryDeadlineLocalTime: "07:45",
      completionDeadlineLocalTime: "07:45",
    },
    tools: TOOLS.time,
    providerDependencies: [dependency(PROVIDER.time)],
    destinationBindingId: "carlos-work-email-binding",
    timeoutSeconds: 600,
    sourceProcedure: "jobs/time-management/procedure.md",
  }),
  entry({
    id: "time-management-monthly-report",
    family: "time_management",
    label: "Time Management monthly work report",
    privacyClass: "work",
    schedule: { kind: "hook", localTimes: ["last planned workday 16:45"] },
    deadlines: {
      preparationDeadlineLocalTime: "16:30",
      visibleDeliveryDeadlineLocalTime: "16:45",
      completionDeadlineLocalTime: "16:45",
    },
    tools: TOOLS.time,
    providerDependencies: [dependency(PROVIDER.time)],
    destinationBindingId: "carlos-work-email-binding",
    timeoutSeconds: 600,
    sourceProcedure: "jobs/time-management/procedure.md",
  }),
  entry({
    id: "private-health-0815",
    family: "private_health",
    label: "Private health morning checkpoint",
    privacyClass: "private_health",
    schedule: { kind: "cron", localTimes: ["08:15"], cron: "10 8 * * *" },
    deadlines: {
      preparationDeadlineLocalTime: "08:10",
      visibleDeliveryDeadlineLocalTime: "08:15",
      completionDeadlineLocalTime: "08:15",
    },
    tools: TOOLS.privateHealth,
    providerDependencies: [dependency(PROVIDER.health)],
    destinationBindingId: "lisa-telegram-binding",
    timeoutSeconds: 600,
    sourceProcedure: "jobs/health/procedure.md",
  }),
  entry({
    id: "private-health-1315",
    family: "private_health",
    label: "Private health midday checkpoint",
    privacyClass: "private_health",
    schedule: { kind: "cron", localTimes: ["13:15"], cron: "10 13 * * *" },
    deadlines: {
      preparationDeadlineLocalTime: "13:10",
      visibleDeliveryDeadlineLocalTime: "13:15",
      completionDeadlineLocalTime: "13:15",
    },
    tools: TOOLS.privateHealth,
    providerDependencies: [dependency(PROVIDER.health)],
    destinationBindingId: "lisa-telegram-binding",
    timeoutSeconds: 600,
    sourceProcedure: "jobs/health/procedure.md",
  }),
  entry({
    id: "private-health-2245",
    family: "private_health",
    label: "Private health evening checkpoint",
    privacyClass: "private_health",
    schedule: { kind: "cron", localTimes: ["22:45"], cron: "40 22 * * *" },
    deadlines: {
      preparationDeadlineLocalTime: "22:40",
      visibleDeliveryDeadlineLocalTime: "22:45",
      completionDeadlineLocalTime: "22:45",
    },
    tools: TOOLS.privateHealth,
    providerDependencies: [dependency(PROVIDER.health)],
    destinationBindingId: "lisa-telegram-binding",
    timeoutSeconds: 600,
    sourceProcedure: "jobs/health/procedure.md",
  }),
  entry({
    id: "private-health-drive-export",
    family: "private_health",
    label: "Private health encrypted Drive export",
    privacyClass: "private_health",
    schedule: { kind: "hook", localTimes: ["after nightly ledger write"] },
    deadlines: {
      preparationDeadlineLocalTime: "after lisa-private-health-2245-v1 succeeds",
      visibleDeliveryDeadlineLocalTime: null,
      completionDeadlineLocalTime: "23:59",
    },
    tools: ["health.export_encrypted", "health.verify_export"],
    providerDependencies: [dependency(PROVIDER.health)],
    destinationBindingId: "carlos-personal-email-binding",
    timeoutSeconds: 900,
    sourceProcedure: "jobs/health/procedure.md",
  }),
  entry({
    id: "private-health-reassessment",
    family: "private_health",
    label: "Private health monthly reassessment",
    privacyClass: "private_health",
    schedule: { kind: "hook", localTimes: ["first day monthly"] },
    deadlines: {
      preparationDeadlineLocalTime: "07:45",
      visibleDeliveryDeadlineLocalTime: null,
      completionDeadlineLocalTime: "08:00",
    },
    tools: TOOLS.privateHealth,
    providerDependencies: [dependency(PROVIDER.health)],
    destinationBindingId: "carlos-personal-email-binding",
    timeoutSeconds: 900,
    sourceProcedure: "jobs/health/procedure.md",
  }),
  entry({
    id: "private-health-monthly-report",
    family: "private_health",
    label: "Private health monthly report",
    privacyClass: "private_health",
    schedule: { kind: "hook", localTimes: ["first day monthly 08:00"] },
    deadlines: {
      preparationDeadlineLocalTime: "07:45",
      visibleDeliveryDeadlineLocalTime: "08:00",
      completionDeadlineLocalTime: "08:00",
    },
    tools: TOOLS.privateHealth,
    providerDependencies: [dependency(PROVIDER.health)],
    destinationBindingId: "carlos-personal-email-binding",
    timeoutSeconds: 900,
    sourceProcedure: "jobs/health/procedure.md",
  }),
];

export const LISA_JOB_CATALOGUE: LisaJobCatalogue = Object.freeze({
  catalogueVersion: LISA_CATALOGUE_VERSION,
  sourceStatus: LISA_CATALOGUE_SOURCE_STATUS,
  timezone: LISA_JOB_TIME_ZONE,
  deliveryMode: LISA_CATALOGUE_DELIVERY_MODE,
  families: LISA_JOB_IDS,
  entries,
  hardStops: LISA_CATALOGUE_HARD_STOPS,
});

function validateLocalTime(value: string): boolean {
  return (
    value === "hourly" ||
    value === "when due" ||
    value.includes(" ") ||
    /^\d{2}:\d{2}$/u.test(value)
  );
}

export function validateLisaJobCatalogue(
  catalogue: LisaJobCatalogue = LISA_JOB_CATALOGUE,
): string[] {
  const errors: string[] = [];
  if (catalogue.catalogueVersion !== LISA_CATALOGUE_VERSION)
    errors.push("catalogue version mismatch");
  if (catalogue.sourceStatus !== LISA_CATALOGUE_SOURCE_STATUS)
    errors.push("catalogue must be source-only");
  if (catalogue.timezone !== LISA_JOB_TIME_ZONE)
    errors.push("catalogue timezone must be Asia/Taipei");
  if (catalogue.deliveryMode !== "none") errors.push("catalogue delivery mode must be none");
  if (
    catalogue.families.length !== LISA_JOB_IDS.length ||
    catalogue.families.some((family, index) => family !== LISA_JOB_IDS[index])
  ) {
    errors.push("catalogue families must exactly match the ten canonical Lisa job ids");
  }
  const ids = new Set<string>();
  const standaloneTimes = new Set<string>();
  for (const item of catalogue.entries) {
    try {
      assertLisaJobId(item.family);
      assertLisaScheduleMetadata(LISA_JOB_SCHEDULE_METADATA[item.family]);
      assertSafeIdentifier(item.id, "catalogue entry id");
      if (item.providerDependencies.length === 0)
        errors.push(`${item.id}: provider dependency required`);
      for (const provider of item.providerDependencies) {
        assertProviderReceiptReference({ ...provider, receivedAtMs: 1_700_000_000_000 });
        assertSafeIdentifier(provider.credentialBindingId, "credentialBindingId");
      }
    } catch (error) {
      errors.push(`${item.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (ids.has(item.id)) errors.push(`${item.id}: duplicate catalogue entry id`);
    ids.add(item.id);
    if (item.enabled !== false) errors.push(`${item.id}: enabled must be false`);
    if (item.schedule.timeZone !== LISA_JOB_TIME_ZONE)
      errors.push(`${item.id}: schedule timezone must be Asia/Taipei`);
    if (item.delivery.mode !== LISA_CATALOGUE_DELIVERY_MODE)
      errors.push(`${item.id}: delivery.mode must be none`);
    if (item.privacyClass === "private_health" && item.family !== "private_health")
      errors.push(`${item.id}: private health family mismatch`);
    if (
      (item.family === "librarian" ||
        item.family === "backup" ||
        item.family === "memory_dreaming") &&
      (item.schedule.kind === "cron" || Boolean(item.schedule.cron))
    ) {
      errors.push(`${item.id}: ${item.family} must not be an OpenClaw cron declaration`);
    }
    if (item.destinationBindingId !== null) {
      try {
        assertDestinationBindingId(item.destinationBindingId);
      } catch (error) {
        errors.push(`${item.id}: invalid destination binding`);
      }
    }
    if (
      !Number.isInteger(item.timeoutSeconds) ||
      item.timeoutSeconds <= 0 ||
      item.timeoutSeconds > 1_800
    )
      errors.push(`${item.id}: timeout must be between 1 and 30 minutes`);
    if (item.idempotencyKey !== idempotencyKey(item.family, item.id))
      errors.push(`${item.id}: unstable idempotency key`);
    if (
      item.hardStops.length !== LISA_CATALOGUE_HARD_STOPS.length ||
      item.hardStops.some((stop, index) => stop !== LISA_CATALOGUE_HARD_STOPS[index])
    )
      errors.push(`${item.id}: hard stops missing`);
    for (const time of item.schedule.localTimes)
      if (!validateLocalTime(time)) errors.push(`${item.id}: invalid local time ${time}`);
    if (item.schedule.kind === "embedded" && !item.schedule.embeddedIn?.length)
      errors.push(`${item.id}: embedded entry must name its host`);
    if (
      item.schedule.embeddedIn?.some(
        (host) => typeof host !== "string" || host.length === 0 || host === item.id,
      )
    ) {
      errors.push(`${item.id}: embedded host reference is invalid`);
    }
    if (
      item.schedule.kind !== "embedded" &&
      item.schedule.localTimes.every((time) => /^\d{2}:\d{2}$/u.test(time))
    ) {
      for (const time of item.schedule.localTimes) standaloneTimes.add(`${item.family}:${time}`);
    }
  }
  for (const item of catalogue.entries) {
    if (item.family === "battery_tracking") {
      for (const time of item.schedule.localTimes) {
        if (standaloneTimes.has(`battery_tracking:${time}`))
          errors.push(`${item.id}: duplicate standalone battery schedule at ${time}`);
      }
      if (item.schedule.kind !== "embedded")
        errors.push(`${item.id}: battery checkpoints must be embedded`);
    }
  }
  return errors;
}

export function assertValidLisaJobCatalogue(
  catalogue: LisaJobCatalogue = LISA_JOB_CATALOGUE,
): void {
  const errors = validateLisaJobCatalogue(catalogue);
  if (errors.length) throw new Error(`invalid Lisa job catalogue: ${errors.join("; ")}`);
}

export function canonicalLisaJobCatalogueJson(
  catalogue: LisaJobCatalogue = LISA_JOB_CATALOGUE,
): string {
  assertValidLisaJobCatalogue(catalogue);
  return JSON.stringify(catalogue);
}

export function hashLisaJobCatalogue(catalogue: LisaJobCatalogue = LISA_JOB_CATALOGUE): string {
  return createHash("sha256").update(canonicalLisaJobCatalogueJson(catalogue)).digest("hex");
}

export function checkLisaProviderBindings(
  bindings: Readonly<Record<string, LisaProviderBinding>> | undefined,
  catalogue: LisaJobCatalogue = LISA_JOB_CATALOGUE,
): LisaCatalogueProviderDecision {
  assertValidLisaJobCatalogue(catalogue);
  const missing = new Set<string>();
  for (const item of catalogue.entries) {
    for (const dependency of item.providerDependencies) {
      const binding = bindings?.[dependency.providerId];
      if (!binding) {
        missing.add(`${dependency.providerId}:missing-release-or-credential-binding`);
        continue;
      }
      if (binding.releaseRef !== dependency.releaseRef)
        missing.add(`${dependency.providerId}:release-mismatch`);
      if (binding.contractRef !== dependency.contractRef)
        missing.add(`${dependency.providerId}:contract-mismatch`);
      if (binding.credentialBindingId !== dependency.credentialBindingId)
        missing.add(`${dependency.providerId}:credential-binding-mismatch`);
    }
  }
  if (missing.size) {
    return {
      status: "HOLD",
      missing: [...missing].toSorted(),
      reason: `HOLD: exact provider release and opaque credential binding required; ${[...missing].toSorted().join(", ")}`,
    };
  }
  return {
    status: "SOURCE_READY_SCHEDULES_DISABLED",
    missing: [],
    reason: "source catalogue validated; schedules remain disabled and no activation is authorized",
  };
}

export function catalogueSummary(catalogue: LisaJobCatalogue = LISA_JOB_CATALOGUE): Readonly<{
  familyCount: number;
  entryCount: number;
  hash: string;
  sourceStatus: typeof LISA_CATALOGUE_SOURCE_STATUS;
}> {
  assertValidLisaJobCatalogue(catalogue);
  return {
    familyCount: catalogue.families.length,
    entryCount: catalogue.entries.length,
    hash: hashLisaJobCatalogue(catalogue),
    sourceStatus: catalogue.sourceStatus,
  };
}

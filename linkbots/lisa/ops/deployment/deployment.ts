import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const LISA_BACKUP_SERVICE = "linktrend-lisa-backup.service" as const;
export const LISA_BACKUP_TIMER = "linktrend-lisa-backup.timer" as const;
export const LISA_PRIVATE_RESTORE_SERVICE =
  "linktrend-lisa-private-health-restore.service" as const;

export type DeploymentUnitName =
  | typeof LISA_BACKUP_SERVICE
  | typeof LISA_BACKUP_TIMER
  | typeof LISA_PRIVATE_RESTORE_SERVICE;

export type DeploymentPaths = Readonly<{
  checkoutRoot: string;
  stateRoot: string;
  backupRoot: string;
  receiptRoot: string;
}>;

export type DeploymentUnit = Readonly<{
  name: DeploymentUnitName;
  contents: string;
}>;

export type DeploymentPlan = Readonly<{
  profile: "lisa";
  user: string;
  paths: DeploymentPaths;
  units: readonly DeploymentUnit[];
  requiredDirectories: readonly string[];
  activation: readonly string[];
  rollback: readonly string[];
}>;

export type DeploymentValidation = Readonly<{
  valid: true;
  unitNames: readonly DeploymentUnitName[];
  prohibitedPatterns: readonly string[];
}>;

const PROHIBITED_PATTERNS = [
  "/Users/",
  "/Applications/",
  "\\Users\\",
  "\\Applications\\",
  "OPENCLAW_GATEWAY_TOKEN=",
  "GOOGLE_APPLICATION_CREDENTIALS=",
  "PRIVATE_KEY=",
  "SECRET_VALUE=",
  "openclaw cron",
] as const;

function fail(code: string): never {
  throw new Error(`lisa_deployment_${code}`);
}

function hasUnitControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x1f || codePoint === 0x7f) {
      return true;
    }
  }
  return false;
}

function linuxAbsolutePath(value: string, field: string): string {
  if (
    !value.startsWith("/") ||
    !/^\/[A-Za-z0-9._/+:-]*$/u.test(value) ||
    hasUnitControlCharacter(value) ||
    value.includes("\\")
  ) {
    fail(`invalid_${field}`);
  }
  for (const prohibited of ["/Users/", "/Applications/"]) {
    if (value.includes(prohibited)) {
      fail(`mac_path_${field}`);
    }
  }
  return value.replace(/\/+$/u, "") || "/";
}

function render(template: string, replacements: Readonly<Record<string, string>>): string {
  const rendered = template.replace(/\{\{([A-Z_]+)\}\}/gu, (_match, key: string) => {
    const value = replacements[key];
    if (!value) {
      fail(`missing_template_value:${key}`);
    }
    return value;
  });
  if (/\{\{[A-Z_]+\}\}/u.test(rendered)) {
    fail("unrendered_template_value");
  }
  return rendered;
}

export const BACKUP_SERVICE_TEMPLATE = `[Unit]
Description=Lisa encrypted off-host backup
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
User={{SERVICE_USER}}
Group={{SERVICE_USER}}
ExecStart=/usr/local/lib/openclaw/lisa-backup --profile lisa --checkout {{CHECKOUT_ROOT}} --state {{STATE_ROOT}} --backup-root {{BACKUP_ROOT}} --receipt-root {{RECEIPT_ROOT}}
EnvironmentFile=-/etc/openclaw/lisa/backup.env
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths={{BACKUP_ROOT}} {{RECEIPT_ROOT}}
UMask=0077
TimeoutStartSec=45min
`;

export const BACKUP_TIMER_TEMPLATE = `[Unit]
Description=Lisa encrypted off-host backup schedule

[Timer]
OnCalendar=*-*-* 05:30:00 Asia/Taipei
Persistent=true
Unit=${LISA_BACKUP_SERVICE}

[Install]
WantedBy=timers.target
`;

export const PRIVATE_RESTORE_SERVICE_TEMPLATE = `[Unit]
Description=Lisa disposable private-state restore verification

[Service]
Type=oneshot
User={{SERVICE_USER}}
Group={{SERVICE_USER}}
ExecStart=/usr/local/lib/openclaw/lisa-backup --profile lisa --restore-verify --backup-root {{BACKUP_ROOT}} --receipt-root {{RECEIPT_ROOT}}
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
IPAddressDeny=any
ReadWritePaths={{RECEIPT_ROOT}}
UMask=0077
TimeoutStartSec=15min
`;

export function buildDeploymentPlan(input: {
  serviceUser?: string;
  paths: DeploymentPaths;
}): DeploymentPlan {
  const serviceUser = input.serviceUser ?? "openclaw-lisa";
  if (!/^[a-z_][a-z0-9_-]{0,31}$/u.test(serviceUser)) {
    fail("invalid_service_user");
  }
  const paths = Object.freeze({
    checkoutRoot: linuxAbsolutePath(input.paths.checkoutRoot, "checkout_root"),
    stateRoot: linuxAbsolutePath(input.paths.stateRoot, "state_root"),
    backupRoot: linuxAbsolutePath(input.paths.backupRoot, "backup_root"),
    receiptRoot: linuxAbsolutePath(input.paths.receiptRoot, "receipt_root"),
  });
  const replacements = {
    SERVICE_USER: serviceUser,
    ...Object.fromEntries(
      Object.entries({
        CHECKOUT_ROOT: paths.checkoutRoot,
        STATE_ROOT: paths.stateRoot,
        BACKUP_ROOT: paths.backupRoot,
        RECEIPT_ROOT: paths.receiptRoot,
      }),
    ),
  };
  const units = Object.freeze([
    Object.freeze({
      name: LISA_BACKUP_SERVICE,
      contents: render(BACKUP_SERVICE_TEMPLATE, replacements),
    }),
    Object.freeze({
      name: LISA_BACKUP_TIMER,
      contents: BACKUP_TIMER_TEMPLATE,
    }),
    Object.freeze({
      name: LISA_PRIVATE_RESTORE_SERVICE,
      contents: render(PRIVATE_RESTORE_SERVICE_TEMPLATE, replacements),
    }),
  ]);
  return Object.freeze({
    profile: "lisa",
    user: serviceUser,
    paths,
    units,
    requiredDirectories: Object.freeze([paths.stateRoot, paths.backupRoot, paths.receiptRoot]),
    activation: Object.freeze([
      `install ${LISA_BACKUP_SERVICE} and ${LISA_BACKUP_TIMER} as reviewed units`,
      `systemctl enable --now ${LISA_BACKUP_TIMER}`,
      `systemctl start ${LISA_PRIVATE_RESTORE_SERVICE} only during a disposable restore drill`,
      "verify the sanitized receipt before considering the backup current",
    ]),
    rollback: Object.freeze([
      `systemctl disable --now ${LISA_BACKUP_TIMER}`,
      `retain the last verified backup and receipt under ${paths.backupRoot}`,
      `restore the prior reviewed unit files and restart only ${LISA_BACKUP_SERVICE} when approved`,
    ]),
  });
}

export function readCommittedDeploymentUnits(): readonly DeploymentUnit[] {
  const unitDirectory = dirname(fileURLToPath(import.meta.url));
  return Object.freeze(
    [LISA_BACKUP_SERVICE, LISA_BACKUP_TIMER, LISA_PRIVATE_RESTORE_SERVICE].map((name) =>
      Object.freeze({
        name,
        contents: readFileSync(join(unitDirectory, name), "utf8"),
      }),
    ),
  );
}

export function assertCommittedUnitsMatchPlan(plan: DeploymentPlan): true {
  const committed = Object.fromEntries(
    readCommittedDeploymentUnits().map((unit) => [unit.name, unit.contents]),
  );
  for (const unit of plan.units) {
    if (committed[unit.name] !== unit.contents) {
      fail(`committed_unit_drift:${unit.name}`);
    }
  }
  validateDeploymentPlan(plan);
  return true;
}

export function validateDeploymentPlan(plan: DeploymentPlan): DeploymentValidation {
  if (plan.profile !== "lisa" || plan.units.length !== 3) {
    fail("invalid_plan_shape");
  }
  for (const [field, value] of Object.entries(plan.paths)) {
    linuxAbsolutePath(value, field);
  }
  const names = plan.units.map((unit) => unit.name);
  if (
    new Set(names).size !== 3 ||
    !names.includes(LISA_BACKUP_SERVICE) ||
    !names.includes(LISA_BACKUP_TIMER) ||
    !names.includes(LISA_PRIVATE_RESTORE_SERVICE)
  ) {
    fail("missing_required_unit");
  }
  const contents = plan.units.map((unit) => unit.contents).join("\n");
  for (const prohibited of PROHIBITED_PATTERNS) {
    if (contents.includes(prohibited)) {
      fail(`prohibited_deployment_content:${prohibited}`);
    }
  }
  for (const required of ["ProtectSystem=strict", "NoNewPrivileges=true", "UMask=0077"]) {
    if (!contents.includes(required)) {
      fail(`missing_hardening:${required}`);
    }
  }
  const timer = plan.units.find((unit) => unit.name === LISA_BACKUP_TIMER);
  if (!timer?.contents.includes("OnCalendar=*-*-* 05:30:00 Asia/Taipei")) {
    fail("invalid_backup_schedule");
  }
  return Object.freeze({
    valid: true,
    unitNames: Object.freeze(names),
    prohibitedPatterns: PROHIBITED_PATTERNS,
  });
}

export type RollbackExecutor = Readonly<{
  stopBackupTimer: () => Promise<void>;
  restorePreviousUnits: () => Promise<void>;
  preserveVerifiedBackup: () => Promise<void>;
  startBackupService: () => Promise<void>;
}>;

export async function executeSourceRollback(
  executor: RollbackExecutor,
): Promise<Readonly<{ status: "rolled_back" }>> {
  await executor.stopBackupTimer();
  await executor.restorePreviousUnits();
  await executor.preserveVerifiedBackup();
  await executor.startBackupService();
  return Object.freeze({ status: "rolled_back" });
}

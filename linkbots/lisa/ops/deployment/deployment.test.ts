import { describe, expect, it } from "vitest";
import {
  assertBackupDestinationBindings,
  buildBackupReceipt,
  createSourceArchive,
  decryptAndVerifyPrivateSnapshot,
  encryptPrivateSnapshot,
  uploadEncryptedSnapshot,
  verifyDisposablePrivateRestore,
} from "../backup/backup.js";
import {
  BACKUP_SERVICE_TEMPLATE,
  BACKUP_TIMER_TEMPLATE,
  LISA_BACKUP_SERVICE,
  LISA_BACKUP_TIMER,
  LISA_PRIVATE_RESTORE_SERVICE,
  assertCommittedUnitsMatchPlan,
  buildDeploymentPlan,
  executeSourceRollback,
  validateDeploymentPlan,
} from "./deployment.js";

const PATHS = {
  checkoutRoot: "/opt/linktrend/openclaw_prime",
  stateRoot: "/var/lib/openclaw/lisa/state",
  backupRoot: "/var/backups/openclaw/lisa",
  receiptRoot: "/var/lib/openclaw/lisa/receipts",
};

describe("PKT-09 source deployment recreation", () => {
  it("renders the three Lisa-only units with Linux paths and hardening", () => {
    const plan = buildDeploymentPlan({ paths: PATHS });
    const validation = validateDeploymentPlan(plan);
    expect(validation).toMatchObject({ valid: true });
    expect(validation.unitNames).toEqual([
      LISA_BACKUP_SERVICE,
      LISA_BACKUP_TIMER,
      LISA_PRIVATE_RESTORE_SERVICE,
    ]);
    expect(plan.units[0].contents).toContain("--profile lisa");
    expect(plan.units[0].contents).toContain("ProtectSystem=strict");
    expect(plan.units[1].contents).toContain("OnCalendar=*-*-* 05:30:00 Asia/Taipei");
    expect(plan.units[2].contents).toContain("IPAddressDeny=any");
    expect(plan.units.map((unit) => unit.contents).join("\n")).not.toMatch(
      /(?:\/Users\/|\/Applications\/)/u,
    );
    expect(assertCommittedUnitsMatchPlan(plan)).toBe(true);
  });

  it("rejects Mac paths and inline credentials before any host action", () => {
    expect(() =>
      buildDeploymentPlan({
        paths: { ...PATHS, checkoutRoot: "/Users/carlos/openclaw_prime" },
      }),
    ).toThrow("mac_path_checkout_root");
    expect(() =>
      validateDeploymentPlan({
        ...buildDeploymentPlan({ paths: PATHS }),
        units: [
          {
            name: LISA_BACKUP_SERVICE,
            contents: `${BACKUP_SERVICE_TEMPLATE}\nOPENCLAW_GATEWAY_TOKEN=fixture`,
          },
          { name: LISA_BACKUP_TIMER, contents: BACKUP_TIMER_TEMPLATE },
          {
            name: LISA_PRIVATE_RESTORE_SERVICE,
            contents: "ProtectSystem=strict NoNewPrivileges=true UMask=0077",
          },
        ],
      }),
    ).toThrow("prohibited_deployment_content:OPENCLAW_GATEWAY_TOKEN=");
  });

  it("rejects newline/control injection before rendering unit directives", () => {
    expect(() =>
      buildDeploymentPlan({
        paths: { ...PATHS, checkoutRoot: "/opt/openclaw_prime\nExecStart=/bin/evil" },
      }),
    ).toThrow("invalid_checkout_root");
    expect(() =>
      buildDeploymentPlan({
        paths: { ...PATHS, receiptRoot: "/var/lib/openclaw/lisa/receipts%N" },
      }),
    ).toThrow("invalid_receipt_root");
  });

  it("executes rollback in a fixed order and preserves the verified backup", async () => {
    const events: string[] = [];
    const result = await executeSourceRollback({
      stopBackupTimer: async () => {
        events.push("stop-timer");
      },
      restorePreviousUnits: async () => {
        events.push("restore-units");
      },
      preserveVerifiedBackup: async () => {
        events.push("preserve-backup");
      },
      startBackupService: async () => {
        events.push("start-service");
      },
    });
    expect(result).toEqual({ status: "rolled_back" });
    expect(events).toEqual(["stop-timer", "restore-units", "preserve-backup", "start-service"]);
  });

  it("composes encrypted backup, unit recreation, disposable restore, and rollback offline", async () => {
    const destinations = assertBackupDestinationBindings({
      companyArchiveBindingId: "company-archive-binding",
      privateSnapshotBindingId: "synthetic-offline-binding",
    });
    const sourceArchive = createSourceArchive([
      {
        path: "ops/deployment/reviewed-unit-files",
        kind: "procedure",
        bytes: new TextEncoder().encode("synthetic reviewed units"),
      },
      {
        path: "config/openclaw.json",
        kind: "source",
        bytes: new TextEncoder().encode("synthetic config reference"),
      },
    ]);
    const key = new Uint8Array(32).fill(7);
    const snapshot = await encryptPrivateSnapshot({
      plaintext: new TextEncoder().encode("SQLite format 3\0synthetic"),
      keyReference: {
        provider: "google-secret-manager",
        secretName: "projects/synthetic/secrets/lisa-backup-key",
        version: "1",
        workloadIdentityAudience:
          "https://iam.googleapis.com/projects/synthetic/locations/global/workloadIdentityPools/lisa",
      },
      nonce: new Uint8Array(12).fill(3),
      resolveKey: async () => key,
    });
    const upload = await uploadEncryptedSnapshot({
      snapshot,
      destinationBindingId: destinations.privateSnapshotBindingId,
      uploader: async ({ objectSha256, objectBytes }) => ({
        objectSha256,
        objectBytes: objectBytes.byteLength,
      }),
    });
    const removed: string[] = [];
    const restore = await verifyDisposablePrivateRestore({
      snapshot,
      resolveKey: async () => key,
      quickCheck: (bytes) => new TextDecoder().decode(bytes).startsWith("SQLite format 3"),
      makeTemporaryDirectory: async () => "/var/tmp/lisa-pkt09-offline-restore",
      removeTemporaryDirectory: async (directory) => {
        removed.push(directory);
      },
    });
    const decrypted = await decryptAndVerifyPrivateSnapshot({
      snapshot,
      resolveKey: async () => key,
      quickCheck: (bytes) => new TextDecoder().decode(bytes).startsWith("SQLite format 3"),
    });
    const receipt = buildBackupReceipt({
      sourceArchive,
      snapshot,
      upload,
      restore,
      capturedAtMs: 1_755_000_000_000,
    });
    const plan = buildDeploymentPlan({ paths: PATHS });
    expect(receipt.retention).toBe("promote_current");
    expect(JSON.stringify(receipt)).not.toContain("SQLite format 3");
    expect(JSON.stringify(receipt)).not.toContain("synthetic config reference");
    expect(assertCommittedUnitsMatchPlan(plan)).toBe(true);
    expect(removed).toEqual(["/var/tmp/lisa-pkt09-offline-restore"]);
    expect(decrypted.verification).toEqual(restore);
    const events: string[] = [];
    await executeSourceRollback({
      stopBackupTimer: async () => {
        events.push("stop-timer");
      },
      restorePreviousUnits: async () => {
        events.push("restore-units");
      },
      preserveVerifiedBackup: async () => {
        events.push("preserve-backup");
      },
      startBackupService: async () => {
        events.push("start-service");
      },
    });
    expect(events).toEqual(["stop-timer", "restore-units", "preserve-backup", "start-service"]);
  });
});

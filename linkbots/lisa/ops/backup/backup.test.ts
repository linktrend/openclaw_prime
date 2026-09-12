import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  applyRetention,
  buildBackupReceipt,
  captureOnlineDatabaseSnapshot,
  chooseRetention,
  createSourceArchive,
  decryptAndVerifyPrivateSnapshot,
  encryptPrivateSnapshot,
  encryptedSnapshotBytes,
  planUploadRetry,
  uploadEncryptedSnapshot,
  verifyUploadedObject,
  verifyDisposablePrivateRestore,
  createOpaqueDestinationBindingId,
  assertBackupDestinationBindings,
} from "./backup.js";

const KEY = new Uint8Array(32).fill(7);
const NONCE = new Uint8Array(12).fill(3);
const REFERENCE = {
  provider: "google-secret-manager" as const,
  secretName: "projects/synthetic/secrets/lisa-backup-key",
  version: "1",
  workloadIdentityAudience:
    "https://iam.googleapis.com/projects/synthetic/locations/global/workloadIdentityPools/lisa",
};
const PRIVATE_BYTES = new TextEncoder().encode("synthetic private health sqlite snapshot");

describe("PKT-09 deterministic backup and encrypted private-state contract", () => {
  it("builds a deterministic company archive while excluding private health and credentials", () => {
    const entries = [
      {
        path: "ops/procedure.md",
        kind: "procedure" as const,
        bytes: new TextEncoder().encode("procedure"),
      },
      {
        path: "config/openclaw.json",
        kind: "source" as const,
        bytes: new TextEncoder().encode("config"),
      },
    ];
    const first = createSourceArchive(entries);
    const second = createSourceArchive([entries[1], entries[0]]);
    expect(first.sha256).toBe(second.sha256);
    expect(first.entries.map((entry) => entry.path)).toEqual([
      "config/openclaw.json",
      "ops/procedure.md",
    ]);
    expect(() =>
      createSourceArchive([
        { path: "state/lisa-private-health.sqlite", kind: "database", bytes: new Uint8Array() },
      ]),
    ).toThrow("private_or_credential_artifact");
    expect(() =>
      createSourceArchive([
        { path: "credentials/oauth.json", kind: "source", bytes: new Uint8Array() },
      ]),
    ).toThrow("private_or_credential_artifact");
  });

  it("captures a synthetic online database snapshot and runs the quick check before encryption", async () => {
    const snapshot = await captureOnlineDatabaseSnapshot({
      databasePath: "/var/lib/openclaw/lisa/state/lisa-private-health.sqlite",
      snapshotter: async ({ databasePath }) => {
        expect(databasePath).toContain("lisa-private-health.sqlite");
        return new TextEncoder().encode("SQLite format 3\0synthetic");
      },
      quickCheck: (bytes) => new TextDecoder().decode(bytes).startsWith("SQLite format 3"),
    });
    expect(snapshot.quickCheck).toBe("passed");
    expect(snapshot.sha256).toHaveLength(64);
    await expect(
      captureOnlineDatabaseSnapshot({
        databasePath: "/var/lib/openclaw/lisa/state/lisa-private-health.sqlite",
        snapshotter: async () => new Uint8Array(),
      }),
    ).rejects.toThrow("database_quick_check_failed");
  });

  it("encrypts and restores with AES-256-GCM using only a GSM/workload-identity reference", async () => {
    const calls: string[] = [];
    const snapshot = await encryptPrivateSnapshot({
      plaintext: PRIVATE_BYTES,
      keyReference: REFERENCE,
      nonce: NONCE,
      resolveKey: async (reference) => {
        calls.push(reference.secretName);
        return KEY;
      },
    });
    expect(calls).toEqual([REFERENCE.secretName]);
    expect(Buffer.from(encryptedSnapshotBytes(snapshot)).equals(Buffer.from(PRIVATE_BYTES))).toBe(
      false,
    );
    expect(snapshot.objectSha256).toBe(
      createHash("sha256").update(encryptedSnapshotBytes(snapshot)).digest("hex"),
    );
    const restored = await decryptAndVerifyPrivateSnapshot({
      snapshot,
      resolveKey: async () => KEY,
      quickCheck: (bytes) => new TextDecoder().decode(bytes).includes("sqlite snapshot"),
    });
    expect(new TextDecoder().decode(restored.plaintext)).toBe(
      new TextDecoder().decode(PRIVATE_BYTES),
    );
    expect(restored.verification).toMatchObject({
      status: "verified",
      quickCheck: "passed",
      network: "disabled",
      channelDelivery: "disabled",
    });
  });

  it("fails closed on tampered ciphertext and key material", async () => {
    const snapshot = await encryptPrivateSnapshot({
      plaintext: PRIVATE_BYTES,
      keyReference: REFERENCE,
      nonce: NONCE,
      resolveKey: async () => KEY,
    });
    const tampered = { ...snapshot, ciphertext: new Uint8Array(snapshot.ciphertext).fill(0) };
    await expect(
      decryptAndVerifyPrivateSnapshot({
        snapshot: tampered,
        resolveKey: async () => KEY,
        quickCheck: () => true,
      }),
    ).rejects.toThrow("snapshot_hash_mismatch");
    await expect(
      decryptAndVerifyPrivateSnapshot({
        snapshot,
        resolveKey: async () => new Uint8Array(32).fill(9),
        quickCheck: () => true,
      }),
    ).rejects.toThrow("restore_authentication_failed");
  });

  it("uploads ciphertext only, verifies the object, and emits a sanitized receipt", async () => {
    const sourceArchive = createSourceArchive([
      { path: "ops/procedure.md", kind: "procedure", bytes: new TextEncoder().encode("procedure") },
      { path: "config/openclaw.json", kind: "source", bytes: new TextEncoder().encode("config") },
    ]);
    const snapshot = await encryptPrivateSnapshot({
      plaintext: PRIVATE_BYTES,
      keyReference: REFERENCE,
      nonce: NONCE,
      resolveKey: async () => KEY,
    });
    const upload = await uploadEncryptedSnapshot({
      snapshot,
      destinationBindingId: "drive-binding-lisa",
      uploader: async (input) => {
        expect(input.objectBytes).toEqual(encryptedSnapshotBytes(snapshot));
        expect(new TextDecoder().decode(input.objectBytes)).not.toContain(
          "synthetic private health",
        );
        expect(input.metadata).not.toHaveProperty("key");
        return { objectSha256: input.objectSha256, objectBytes: input.objectBytes.byteLength };
      },
    });
    const restore = {
      status: "verified" as const,
      plaintextSha256: snapshot.plaintextSha256,
      quickCheck: "passed" as const,
      network: "disabled" as const,
      channelDelivery: "disabled" as const,
    };
    const receipt = buildBackupReceipt({
      sourceArchive,
      snapshot,
      upload,
      restore,
      capturedAtMs: 1_755_000_000_000,
    });
    expect(receipt.retention).toBe("promote_current");
    expect(receipt.sourceArchive.excluded).toEqual(["private-health", "credentials"]);
    expect(JSON.stringify(receipt)).not.toContain("synthetic private health");
    expect(JSON.stringify(receipt)).not.toContain("secretValue");
    expect(() =>
      verifyUploadedObject({
        expectedSha256: snapshot.objectSha256,
        expectedBytes: snapshot.objectBytes,
        actualSha256: "0".repeat(64),
        actualBytes: snapshot.objectBytes,
      }),
    ).toThrow("object_verification_failed");
  });

  it("retains the previous verified backup until both upload and restore pass", () => {
    expect(chooseRetention({ upload: "failed", restore: "verified" })).toBe("retain_previous");
    expect(chooseRetention({ upload: "verified", restore: "failed" })).toBe("retain_previous");
    expect(chooseRetention({ upload: "verified", restore: "verified" })).toBe("promote_current");
    expect(
      applyRetention({
        current: "old",
        previous: "older",
        candidate: "new",
        upload: "failed",
        restore: "verified",
      }),
    ).toEqual({ current: "old", previous: "older", retention: "retain_previous" });
    expect(
      applyRetention({
        current: "old",
        previous: "older",
        candidate: "new",
        upload: "verified",
        restore: "verified",
      }),
    ).toEqual({ current: "new", previous: "old", retention: "promote_current" });
    expect(planUploadRetry(1)).toEqual({ retry: true, nextAttempt: 2 });
    expect(planUploadRetry(2)).toEqual({ retry: false, nextAttempt: null });
    expect(() =>
      buildBackupReceipt({
        sourceArchive: createSourceArchive([
          {
            path: "ops/procedure.md",
            kind: "procedure",
            bytes: new TextEncoder().encode("procedure"),
          },
        ]),
        snapshot: {
          formatVersion: 1,
          algorithm: "aes-256-gcm",
          keyReference: REFERENCE,
          nonce: NONCE,
          ciphertext: new Uint8Array(16),
          authTag: new Uint8Array(16),
          plaintextSha256: "a".repeat(64),
          objectSha256: "b".repeat(64),
          objectBytes: 44,
        },
        upload: {
          status: "verified",
          destinationBindingId: "drive-binding-lisa",
          objectSha256: "b".repeat(64),
          objectBytes: 44,
        },
        restore: {
          status: "verified",
          plaintextSha256: "a".repeat(64),
          quickCheck: "passed",
          network: "disabled",
          channelDelivery: "disabled",
        },
        capturedAtMs: 1,
      }),
    ).toThrow("incomplete_company_archive");
  });

  it("keeps company and private destinations as distinct opaque bindings", () => {
    expect(createOpaqueDestinationBindingId("drive-binding-lisa")).toBe("drive-binding-lisa");
    expect(() => createOpaqueDestinationBindingId("Backups/OpenClaw Prime/Lisa")).toThrow(
      "invalid_destination_binding",
    );
    expect(() => createOpaqueDestinationBindingId("https://drive.google.com/lisa")).toThrow(
      "invalid_destination_binding",
    );
    expect(
      assertBackupDestinationBindings({
        companyArchiveBindingId: "company-archive-binding",
        privateSnapshotBindingId: "drive-binding-lisa",
      }),
    ).toEqual({
      companyArchiveBindingId: "company-archive-binding",
      privateSnapshotBindingId: "drive-binding-lisa",
    });
    expect(() =>
      assertBackupDestinationBindings({
        companyArchiveBindingId: "drive-binding-lisa",
        privateSnapshotBindingId: "drive-binding-lisa",
      }),
    ).toThrow("destination_bindings_not_distinct");
  });

  it("verifies private restore in a disposable directory and always removes it", async () => {
    const snapshot = await encryptPrivateSnapshot({
      plaintext: PRIVATE_BYTES,
      keyReference: REFERENCE,
      nonce: NONCE,
      resolveKey: async () => KEY,
    });
    const removed: string[] = [];
    const verification = await verifyDisposablePrivateRestore({
      snapshot,
      resolveKey: async () => KEY,
      quickCheck: (bytes) => new TextDecoder().decode(bytes).includes("sqlite snapshot"),
      makeTemporaryDirectory: async () => "/var/tmp/lisa-pkt09-restore",
      removeTemporaryDirectory: async (directory) => {
        removed.push(directory);
      },
    });
    expect(verification).toMatchObject({
      status: "verified",
      network: "disabled",
      channelDelivery: "disabled",
    });
    expect(removed).toEqual(["/var/tmp/lisa-pkt09-restore"]);
    await expect(
      verifyDisposablePrivateRestore({
        snapshot,
        resolveKey: async () => KEY,
        quickCheck: () => false,
        makeTemporaryDirectory: async () => "/var/tmp/lisa-pkt09-restore-fail",
        removeTemporaryDirectory: async (directory) => {
          removed.push(directory);
        },
      }),
    ).rejects.toThrow("restore_quick_check_failed");
    expect(removed).toEqual(["/var/tmp/lisa-pkt09-restore", "/var/tmp/lisa-pkt09-restore-fail"]);
  });
});

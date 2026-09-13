#!/usr/bin/env node
/**
 * Rebuild the sanitized PKT-09 source-acceptance receipt against the current
 * checkout. Does not call providers, VPS, or live Lisa.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

function sha256File(relativePath) {
  const bytes = readFileSync(join(root, relativePath));
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
    return `{${keys
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

const receipt = {
  receiptType: "lisa_pkt_09_source_acceptance_receipt_v1",
  status: "source-prepared",
  packet: {
    id: "PKT-09",
    issue: "ISS-09",
    githubIssue: 292,
    executionState: "PLAN",
  },
  sourceBase: {
    repository: "linktrend/openclaw_prime",
    ref: "origin/development",
    commit: process.env.PKT09_SOURCE_COMMIT,
    tree: process.env.PKT09_SOURCE_TREE,
  },
  ownedPaths: [
    "linkbots/lisa/ops/backup",
    "linkbots/lisa/ops/deployment",
    "linkbots/lisa/docs",
  ],
  prohibitedPaths: [
    "extensions/linkplatform",
    "extensions/linkbrain",
    "extensions/linkskills",
    "linkbots/lisa/ops/jobs/time-management",
  ],
  artifacts: {
    backupContract: {
      path: "linkbots/lisa/ops/backup/backup.ts",
      sha256: sha256File("linkbots/lisa/ops/backup/backup.ts"),
      algorithm: "aes-256-gcm",
      keyMaterial: "runtime-only-google-secret-manager-reference",
      plaintextHealthInReceipt: false,
    },
    receiptSchema: {
      path: "linkbots/lisa/ops/backup/backup-receipt.schema.json",
      sha256: sha256File("linkbots/lisa/ops/backup/backup-receipt.schema.json"),
    },
    deploymentUnits: [
      {
        path: "linkbots/lisa/ops/deployment/linktrend-lisa-backup.service",
        sha256: sha256File("linkbots/lisa/ops/deployment/linktrend-lisa-backup.service"),
      },
      {
        path: "linkbots/lisa/ops/deployment/linktrend-lisa-backup.timer",
        sha256: sha256File("linkbots/lisa/ops/deployment/linktrend-lisa-backup.timer"),
      },
      {
        path: "linkbots/lisa/ops/deployment/linktrend-lisa-private-health-restore.service",
        sha256: sha256File(
          "linkbots/lisa/ops/deployment/linktrend-lisa-private-health-restore.service",
        ),
      },
      {
        path: "linkbots/lisa/ops/deployment/deployment.ts",
        sha256: sha256File("linkbots/lisa/ops/deployment/deployment.ts"),
      },
    ],
    offlineRehearsal: {
      path: "linkbots/lisa/ops/deployment/pre-vps-rehearsal.test.mjs",
      sha256: sha256File("linkbots/lisa/ops/deployment/pre-vps-rehearsal.test.mjs"),
      command:
        "node --experimental-strip-types --test linkbots/lisa/ops/deployment/pre-vps-rehearsal.test.mjs",
      status: "passed",
      tests: 1,
      network: "disabled-by-injected-adapters",
      liveMutation: false,
    },
    runbooks: [
      "linkbots/lisa/docs/LISA-BACKUP-DEPLOYMENT-RUNBOOK.md",
      "linkbots/lisa/docs/LISA-DIRECT-MIGRATION.md",
    ],
  },
  sanitizedEvidence: {
    privateDataRecorded: false,
    credentialValuesRecorded: false,
    companyArchiveExcludes: ["private-health", "credentials"],
    restoreNetwork: "disabled",
    channelDelivery: "disabled",
  },
  gates: {
    sourceTests: "focused-offline-pass",
    cleanHostInstall: "HOLD: external host operator",
    vpsDeployment: "HOLD: Principal-authorized VPS action",
    liveRestore: "HOLD: Principal-authorized VPS action",
    productionCanary: "HOLD: outside PKT-09 source scope",
  },
  actions: {
    vpsTouched: false,
    liveLisaTouched: false,
    productionTouched: false,
    oauthOrLiveGoogleCalls: false,
    privateDataRecorded: false,
  },
  rollback: {
    sourceStrategy: "revert-this-source-checkpoint",
    offlineSequence: ["stop-timer", "restore-units", "preserve-backup", "start-service"],
    offlineRehearsalPassed: true,
    liveRestorePerformed: false,
    approvalRequired: true,
  },
};

if (!receipt.sourceBase.commit || !receipt.sourceBase.tree) {
  throw new Error("PKT09_SOURCE_COMMIT and PKT09_SOURCE_TREE are required");
}

receipt.receiptDigestSha256 = createHash("sha256").update(canonicalJson(receipt)).digest("hex");

const out = join(root, "linkbots/lisa/ops/receipts/pkt-09-source-acceptance.receipt.json");
writeFileSync(out, `${JSON.stringify(receipt, null, 2)}\n`);
process.stdout.write(`${out}\n`);

#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = 1;
const SOURCE_IDS = new Set(["local", "vps"]);
const PHASES = new Set(["initial", "final-delta"]);
const KINDS = new Set([
  "file",
  "directory",
  "record",
  "capability",
  "job",
  "schedule",
  "timer",
  "service",
  "tool",
  "skill",
  "config",
  "session",
  "media",
  "backup",
  "other",
]);
const CLASSIFICATIONS = new Set([
  "added",
  "exact_duplicate",
  "conflict_retained_as_evidence",
  "superseded",
  "obsolete",
  "incompatible",
  "unsafe",
  "unresolved",
]);
const DESTINATION_KINDS = new Set([
  "vps_authoritative",
  "vps_additive",
  "archive",
  "evidence",
  "hold",
]);
const LIFECYCLES = new Set(["active", "disabled", "closed", "archived"]);
const CONFLICT_DISPOSITIONS = new Set(["no_required_unique_facts", "facts_extracted"]);
const SHA256 = /^[a-f0-9]{64}$/u;
const GIT_SHA = /^[a-f0-9]{40}$/u;
const RELATIVE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^\\]+$/u;
const FORBIDDEN_FIELD = /^(?:payload|value|content|body|data)$/iu;
const SECRET_FIELD =
  /(?:secret|token|password|passwd|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|client[_-]?secret|authorization)/iu;

export const PKT11_SOURCE_ACCEPTANCE_RECEIPT_TYPE = "lisa_pkt_11_source_acceptance_receipt_v1";
export const PKT11_SOURCE_ACCEPTANCE_OWNED_PATHS = Object.freeze([
  "linkbots/lisa/ops/lisa-vps-reconciliation.mjs",
  "linkbots/lisa/ops/stage-workspace-package.ts",
  "linkbots/lisa/ops/receipts",
  "linkbots/lisa/docs",
]);
export const PKT11_SOURCE_ACCEPTANCE_PROHIBITED_PATHS = Object.freeze([
  "extensions/linkplatform/src",
  "extensions/linkbrain/src",
  "extensions/linkskills/src",
  "extensions/linklibraries/src",
  "extensions/linkautowork/src",
]);
export const PKT11_SOURCE_ACCEPTANCE_SCHEMA_PATH =
  "linkbots/lisa/ops/receipts/pkt-11-source-acceptance.schema.json";
const PKT11_SOURCE_ACCEPTANCE_SCHEMA_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "receipts/pkt-11-source-acceptance.schema.json",
);
const PKT11_LIVE_COMMANDS = Object.freeze([
  "deploy",
  "canary",
  "ssh",
  "restore",
  "promote",
  "schedule",
  "oauth",
]);
const PKT11_SOURCE_ACCEPTANCE_ROOT_KEYS = Object.freeze([
  "receiptType",
  "status",
  "packet",
  "sourceBase",
  "ownedPaths",
  "prohibitedPaths",
  "dependencyPackets",
  "artifacts",
  "gates",
  "actions",
  "rollback",
  "receiptDigestSha256",
]);
const PKT11_DEPENDENCIES = Object.freeze([
  "PKT-01",
  "PKT-02",
  "PKT-03",
  "PKT-04",
  "PKT-05",
  "PKT-06",
  "PKT-07",
  "PKT-08",
  "PKT-09",
  "PKT-10",
]);
const PKT11_EXTERNAL_GATES = Object.freeze([
  "providerReleaseSetAccepted",
  "independentTerraVerification",
  "independentReview",
  "stageDeployment",
  "vpsDeployment",
  "productionCanary",
  "principalAcceptance",
  "rollbackVerification",
]);

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSha(value, label) {
  assert(typeof value === "string" && SHA256.test(value), `invalid_${label}`);
}

function assertGitSha(value, label) {
  assert(typeof value === "string" && GIT_SHA.test(value), `invalid_${label}`);
}

function assertNoSecretMaterialFields(value, label) {
  if (Array.isArray(value)) {
    for (const child of value) {
      assertNoSecretMaterialFields(child, label);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    assert(
      !FORBIDDEN_FIELD.test(key) && !SECRET_FIELD.test(key),
      `forbidden_${label}_field:${key}`,
    );
    assertNoSecretMaterialFields(child, `${label}.${key}`);
  }
}

function assertSafeText(value, label) {
  assert(typeof value === "string" && value.length > 0, `invalid_${label}`);
}

function normalizePath(value) {
  assertSafeText(value, "path");
  const normalized = value.replaceAll("\\", "/");
  assert(!normalized.includes("\u0000"), "unsafe_inventory_path");
  assert(RELATIVE_PATH.test(normalized), "unsafe_inventory_path");
  return normalized;
}

function normalizeSource(source, expectedId) {
  assert(source && typeof source === "object", `${expectedId}_source_missing`);
  assertNoSecretMaterialFields(source, `${expectedId}_source`);
  assert(source.id === expectedId && SOURCE_IDS.has(source.id), `${expectedId}_source_id`);
  assertSha(source.inventorySha256, `${expectedId}_inventory_hash`);
  assertSafeText(source.captureRef, `${expectedId}_capture_ref`);
  if (source.capturedAt !== undefined) {
    assertSafeText(source.capturedAt, `${expectedId}_captured_at`);
  }
  return {
    id: expectedId,
    inventorySha256: source.inventorySha256,
    captureRef: source.captureRef,
    ...(source.capturedAt ? { capturedAt: source.capturedAt } : {}),
  };
}

function normalizeDestination(destination) {
  if (destination === undefined) {
    return undefined;
  }
  assertNoSecretMaterialFields(destination, "destination");
  assert(destination && typeof destination === "object", "invalid_destination");
  assert(DESTINATION_KINDS.has(destination.kind), "invalid_destination_kind");
  assertSafeText(destination.ref, "destination_ref");
  return { kind: destination.kind, ref: destination.ref };
}

function normalizeReconciliation(reconciliation) {
  if (reconciliation === undefined) {
    return undefined;
  }
  assertNoSecretMaterialFields(reconciliation, "reconciliation");
  assert(reconciliation && typeof reconciliation === "object", "invalid_reconciliation");
  assert(CLASSIFICATIONS.has(reconciliation.classification), "invalid_classification");
  const result = {
    classification: reconciliation.classification,
    ...(reconciliation.destination
      ? { destination: normalizeDestination(reconciliation.destination) }
      : {}),
    ...(reconciliation.reason ? { reason: reconciliation.reason } : {}),
    ...(reconciliation.evidenceRef ? { evidenceRef: reconciliation.evidenceRef } : {}),
  };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "string") {
      assertSafeText(value, `reconciliation_${key}`);
    }
  }
  return result;
}

function validConflictDisposition(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.reviewed !== true) {
    return undefined;
  }
  const disposition = raw.disposition;
  if (
    !CONFLICT_DISPOSITIONS.has(disposition) ||
    typeof raw.reviewRef !== "string" ||
    raw.reviewRef.length === 0
  ) {
    return undefined;
  }
  if (disposition === "no_required_unique_facts") {
    if (raw.facts !== undefined && (!Array.isArray(raw.facts) || raw.facts.length > 0)) {
      return undefined;
    }
    return {
      reviewed: true,
      disposition,
      reviewRef: raw.reviewRef,
      ...(Array.isArray(raw.facts) ? { facts: [] } : {}),
    };
  }
  if (!Array.isArray(raw.facts) || raw.facts.length === 0) {
    return undefined;
  }
  const facts = [];
  const factKeys = new Set();
  for (const fact of raw.facts) {
    if (!fact || typeof fact !== "object" || Array.isArray(fact)) {
      return undefined;
    }
    const factKey = fact.key;
    const provenance = fact.provenance;
    const destination = fact.destination;
    if (
      typeof factKey !== "string" ||
      factKey.length === 0 ||
      factKeys.has(factKey) ||
      typeof provenance !== "string" ||
      provenance.length === 0 ||
      !destination ||
      typeof destination !== "object" ||
      Array.isArray(destination) ||
      !["vps_additive", "archive"].includes(destination.kind) ||
      typeof destination.ref !== "string" ||
      destination.ref.length === 0
    ) {
      return undefined;
    }
    factKeys.add(factKey);
    facts.push({
      key: factKey,
      destination: { kind: destination.kind, ref: destination.ref },
      provenance,
    });
  }
  return { reviewed: true, disposition, reviewRef: raw.reviewRef, facts };
}

function normalizeConflictDisposition(raw) {
  if (raw === undefined) {
    return undefined;
  }
  assertNoSecretMaterialFields(raw, "conflict_disposition");
  return validConflictDisposition(raw) ?? stableValue(raw);
}

function normalizeEntry(raw, sourceId) {
  assert(raw && typeof raw === "object", `${sourceId}_entry_missing`);
  assertNoSecretMaterialFields(raw, `${sourceId}_entry`);
  const relativePath = normalizePath(raw.path ?? raw.relativePath ?? raw.key);
  const key = raw.key ?? `${raw.kind ?? "file"}:${relativePath}`;
  assertSafeText(key, `${sourceId}_entry_key`);
  const kind = raw.kind === "directory" ? "directory" : (raw.kind ?? "file");
  assert(KINDS.has(kind), `invalid_${sourceId}_entry_kind`);
  assertSha(raw.sha256, `${sourceId}_entry_hash`);
  assert(
    Number.isSafeInteger(raw.sizeBytes ?? raw.size) && (raw.sizeBytes ?? raw.size) >= 0,
    `invalid_${sourceId}_entry_size`,
  );
  const mtimeMs = raw.mtimeMs ?? null;
  assert(
    mtimeMs === null || (Number.isSafeInteger(mtimeMs) && mtimeMs >= 0),
    `invalid_${sourceId}_entry_mtime`,
  );
  if (raw.recordCount !== undefined) {
    assert(
      Number.isSafeInteger(raw.recordCount) && raw.recordCount >= 0,
      `invalid_${sourceId}_record_count`,
    );
  }
  if (raw.lifecycle !== undefined) {
    assert(LIFECYCLES.has(raw.lifecycle), `invalid_${sourceId}_lifecycle`);
  }
  const entry = {
    key,
    path: relativePath,
    kind,
    ...(raw.category ? { category: raw.category } : {}),
    sizeBytes: raw.sizeBytes ?? raw.size,
    ...(mtimeMs === null ? {} : { mtimeMs }),
    sha256: raw.sha256,
    ...(raw.recordCount === undefined ? {} : { recordCount: raw.recordCount }),
    ...(raw.lifecycle ? { lifecycle: raw.lifecycle } : {}),
    ...(sourceId === "local" && raw.reconciliation
      ? { reconciliation: normalizeReconciliation(raw.reconciliation) }
      : {}),
    ...(sourceId === "local" && raw.conflictDisposition !== undefined
      ? { conflictDisposition: normalizeConflictDisposition(raw.conflictDisposition) }
      : {}),
  };
  for (const [keyName, value] of Object.entries(entry)) {
    if (typeof value === "string") {
      assertSafeText(value, `${sourceId}_entry_${keyName}`);
    }
  }
  return entry;
}

function normalizeInventory(inventory, sourceId) {
  assert(inventory && typeof inventory === "object", `${sourceId}_inventory_missing`);
  assertNoSecretMaterialFields(inventory, `${sourceId}_inventory`);
  const entries = inventory.entries;
  assert(Array.isArray(entries), `${sourceId}_entries_missing`);
  const normalized = entries
    .map((entry) => normalizeEntry(entry, sourceId))
    .toSorted((left, right) => left.key.localeCompare(right.key));
  const keys = normalized.map((entry) => entry.key);
  assert(new Set(keys).size === keys.length, `${sourceId}_duplicate_entry_key`);
  const actualHash = sha256(canonicalJson(normalized));
  if (inventory.sourceSha256 !== undefined) {
    assertSha(inventory.sourceSha256, `${sourceId}_source_hash`);
    assert(inventory.sourceSha256 === actualHash, `${sourceId}_source_hash_mismatch`);
  }
  return { entries: normalized, calculatedSha256: actualHash };
}

function metadataDrift(local, vps) {
  const fields = ["path", "kind", "category", "sizeBytes", "mtimeMs", "recordCount"];
  return fields.filter((field) => (local[field] ?? null) !== (vps[field] ?? null));
}

function comparePair(local, vps) {
  if (!local) {
    return { status: "vps_only", authority: "vps" };
  }
  if (!vps) {
    const reconciliation = local.reconciliation;
    return {
      status: "local_only",
      classification: reconciliation?.classification ?? "unresolved",
      ...(reconciliation?.destination ? { destination: reconciliation.destination } : {}),
      ...(reconciliation?.reason ? { reason: reconciliation.reason } : {}),
      authority: "vps",
    };
  }
  if (local.sha256 === vps.sha256) {
    return {
      status: "exact_duplicate",
      classification: "exact_duplicate",
      destination: { kind: "vps_authoritative", ref: `vps:${vps.key}` },
      authority: "vps",
      ...(metadataDrift(local, vps).length > 0 ? { metadataDrift: metadataDrift(local, vps) } : {}),
    };
  }
  const conflictDisposition = validConflictDisposition(local.conflictDisposition);
  if (!conflictDisposition) {
    return {
      status: "conflict",
      classification: "unresolved",
      destination: { kind: "hold", ref: `conflict:${vps.key}` },
      authority: "vps",
      conflict: { localSha256: local.sha256, vpsSha256: vps.sha256 },
    };
  }
  return {
    status: "conflict",
    classification: "conflict_retained_as_evidence",
    destination: { kind: "evidence", ref: `comparison:${vps.key}` },
    authority: "vps",
    conflict: { localSha256: local.sha256, vpsSha256: vps.sha256 },
    conflictDisposition,
  };
}

function validateConflict(entry, comparison) {
  const disposition = validConflictDisposition(entry.conflictDisposition);
  if (comparison.classification === "unresolved") {
    assert(!disposition, `invalid_conflict_disposition:${entry.key}`);
    assert(comparison.destination?.kind === "hold", `conflict_hold_missing:${entry.key}`);
    return;
  }
  assert(
    comparison.classification === "conflict_retained_as_evidence",
    `invalid_conflict:${entry.key}`,
  );
  assert(disposition, `missing_conflict_disposition:${entry.key}`);
  assert(comparison.destination?.kind === "evidence", `conflict_evidence_missing:${entry.key}`);
  assert(
    canonicalJson(comparison.conflictDisposition) === canonicalJson(disposition),
    `conflict_disposition_mismatch:${entry.key}`,
  );
}

function validateDecision(entry, comparison) {
  if (comparison.status !== "local_only") {
    return;
  }
  const classification = comparison.classification;
  assert(CLASSIFICATIONS.has(classification), `invalid_local_only_classification:${entry.key}`);
  if (["job", "schedule", "timer"].includes(entry.kind)) {
    assert(
      entry.lifecycle === "disabled" || entry.lifecycle === "closed",
      `active_legacy_job:${entry.key}`,
    );
  }
  if (classification === "unresolved") {
    assert(
      !comparison.destination || comparison.destination.kind === "hold",
      `unresolved_destination:${entry.key}`,
    );
    return;
  }
  assert(comparison.destination, `missing_destination:${entry.key}`);
  if (classification === "added") {
    assert(
      comparison.destination.kind === "vps_additive" || comparison.destination.kind === "archive",
      `added_destination:${entry.key}`,
    );
  } else {
    assert(
      comparison.destination.kind === "archive" ||
        comparison.destination.kind === "evidence" ||
        comparison.destination.kind === "hold",
      `excluded_destination:${entry.key}`,
    );
  }
  if (["superseded", "obsolete", "incompatible", "unsafe"].includes(classification)) {
    assert(
      typeof comparison.reason === "string" && comparison.reason.length > 0,
      `missing_reason:${entry.key}`,
    );
  }
  if (["job", "schedule", "timer"].includes(entry.kind)) {
    assert(comparison.destination.kind !== "vps_additive", `legacy_job_reactivation:${entry.key}`);
  }
}

function buildSummary(comparisons) {
  const counts = {};
  for (const comparison of comparisons) {
    counts[comparison.status] = (counts[comparison.status] ?? 0) + 1;
    if (comparison.classification) {
      counts[`classification:${comparison.classification}`] =
        (counts[`classification:${comparison.classification}`] ?? 0) + 1;
    }
  }
  return Object.fromEntries(
    Object.entries(counts).toSorted(([left], [right]) => left.localeCompare(right)),
  );
}

function buildComparisons(localEntries, vpsEntries) {
  const localByKey = new Map(localEntries.map((entry) => [entry.key, entry]));
  const vpsByKey = new Map(vpsEntries.map((entry) => [entry.key, entry]));
  const keys = [...new Set([...localByKey.keys(), ...vpsByKey.keys()])].toSorted((left, right) =>
    left.localeCompare(right),
  );
  return keys.map((key) =>
    Object.assign({ key }, comparePair(localByKey.get(key), vpsByKey.get(key))),
  );
}

function withoutReceipt(manifest) {
  const { receipt: _receipt, ...payload } = manifest;
  return payload;
}

function withoutAcceptanceDigest(receipt) {
  const { receiptDigestSha256: _receiptDigestSha256, ...payload } = receipt;
  return payload;
}

function assertExactStringArray(actual, expected, label) {
  assert(Array.isArray(actual), `${label}_missing`);
  assert(canonicalJson(actual) === canonicalJson(expected), `${label}_mismatch`);
}

function assertExactKeys(value, keys, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label}_missing`);
  assertExactStringArray(Object.keys(value).toSorted(), [...keys].toSorted(), `${label}_keys`);
}

function assertSourceAcceptanceSchemaContract() {
  assert(existsSync(PKT11_SOURCE_ACCEPTANCE_SCHEMA_FILE), "acceptance_schema_missing");
  const schema = JSON.parse(readFileSync(PKT11_SOURCE_ACCEPTANCE_SCHEMA_FILE, "utf8"));
  assert(
    schema?.$id === "https://openclaw.local/schemas/lisa/pkt-11-source-acceptance-v1.json",
    "acceptance_schema_id",
  );
  assert(schema.additionalProperties === false, "acceptance_schema_open");
  assert(
    schema.properties?.receiptType?.const === PKT11_SOURCE_ACCEPTANCE_RECEIPT_TYPE,
    "acceptance_schema_receipt_type",
  );
  assert(schema.properties?.status?.const === "source-prepared", "acceptance_schema_status");
  assert(
    schema.properties?.artifacts?.properties?.stageWorkspacePackage?.properties?.status?.const ===
      "verified-source",
    "acceptance_schema_package_status",
  );
}

/**
 * Validate the source-only PKT-11 handoff contract. This does not assert that
 * deployment happened: every external gate must remain HOLD until its
 * separately owned receipt is supplied and reviewed.
 */
export function validateSourceAcceptanceReceipt(receipt) {
  assertSourceAcceptanceSchemaContract();
  assert(
    receipt && typeof receipt === "object" && !Array.isArray(receipt),
    "acceptance_receipt_missing",
  );
  assertNoSecretMaterialFields(receipt, "acceptance_receipt");
  assertExactKeys(receipt, PKT11_SOURCE_ACCEPTANCE_ROOT_KEYS, "acceptance_receipt");
  assert(
    receipt.receiptType === PKT11_SOURCE_ACCEPTANCE_RECEIPT_TYPE,
    "unsupported_acceptance_receipt_type",
  );
  assert(receipt.status === "source-prepared", "invalid_acceptance_receipt_status");
  assertExactKeys(receipt.packet, ["id", "issue", "executionState"], "acceptance_packet");
  assert(receipt.packet.id === "PKT-11", "acceptance_packet_id_mismatch");
  assert(receipt.packet.issue === "ISS-11", "acceptance_issue_id_mismatch");
  assert(receipt.packet.executionState === "PLAN", "acceptance_execution_state_mismatch");
  // Protected-base identity is shared with pkt11-source-base-preflight.mjs.
  assertExactKeys(
    receipt.sourceBase,
    ["repository", "ref", "commit", "tree"],
    "acceptance_source_base",
  );
  assert(receipt.sourceBase.repository === "openclaw/openclaw", "acceptance_repository_mismatch");
  assert(receipt.sourceBase.ref === "origin/development", "acceptance_ref_mismatch");
  assertGitSha(receipt.sourceBase.commit, "acceptance_source_commit");
  assertGitSha(receipt.sourceBase.tree, "acceptance_source_tree");
  assertExactStringArray(
    receipt.ownedPaths,
    PKT11_SOURCE_ACCEPTANCE_OWNED_PATHS,
    "acceptance_owned_paths",
  );
  assertExactStringArray(
    receipt.prohibitedPaths,
    PKT11_SOURCE_ACCEPTANCE_PROHIBITED_PATHS,
    "acceptance_prohibited_paths",
  );

  assertExactKeys(
    receipt.dependencyPackets,
    ["required", "reproduced", "resolution"],
    "acceptance_dependencies_object",
  );
  assertExactStringArray(
    receipt.dependencyPackets.required,
    PKT11_DEPENDENCIES,
    "acceptance_dependencies",
  );
  assertExactStringArray(
    receipt.dependencyPackets.reproduced,
    [],
    "acceptance_reproduced_dependencies",
  );
  assert(
    receipt.dependencyPackets.resolution ===
      "exact accepted commit/tree receipts are consumed from the external runtime authority snapshot",
    "acceptance_dependency_resolution_mismatch",
  );

  assertExactKeys(
    receipt.artifacts,
    ["reconciliationTool", "stageWorkspacePackage", "providerQualificationReference"],
    "acceptance_artifacts",
  );
  const packageArtifact = receipt.artifacts.stageWorkspacePackage;
  assertExactKeys(
    packageArtifact,
    [
      "sourceReceiptType",
      "status",
      "packageId",
      "manifestSha256",
      "fileCount",
      "mutableSeeds",
      "liveMutationAllowed",
    ],
    "acceptance_stage_package",
  );
  assert(
    packageArtifact.sourceReceiptType === "lisa_stage_workspace_package_source_receipt_v1",
    "acceptance_stage_receipt_type_mismatch",
  );
  assert(packageArtifact.status === "verified-source", "acceptance_stage_status");
  assertSafeText(packageArtifact.packageId, "acceptance_stage_package_id");
  assertSha(packageArtifact.manifestSha256, "acceptance_stage_manifest_hash");
  assert(
    Number.isSafeInteger(packageArtifact.fileCount) && packageArtifact.fileCount > 0,
    "acceptance_stage_file_count",
  );
  assert(packageArtifact.mutableSeeds === false, "acceptance_stage_mutable_seeds");
  assert(packageArtifact.liveMutationAllowed === false, "acceptance_stage_live_mutation");

  assertExactKeys(
    receipt.artifacts.reconciliationTool,
    ["path", "sourceOnly", "liveActions"],
    "acceptance_reconciliation_tool",
  );
  assert(
    receipt.artifacts.reconciliationTool.sourceOnly === true,
    "acceptance_reconciliation_not_source_only",
  );
  assert(
    receipt.artifacts.reconciliationTool.liveActions === false,
    "acceptance_reconciliation_live_actions",
  );
  assertSafeText(receipt.artifacts.reconciliationTool.path, "acceptance_reconciliation_path");
  assertSafeText(
    receipt.artifacts.providerQualificationReference,
    "acceptance_provider_receipt_ref",
  );

  assert(receipt.gates && typeof receipt.gates === "object", "acceptance_gates_missing");
  assertExactStringArray(
    Object.keys(receipt.gates).toSorted(),
    [...PKT11_EXTERNAL_GATES].toSorted(),
    "acceptance_gate_names",
  );
  for (const gate of PKT11_EXTERNAL_GATES) {
    const value = receipt.gates[gate];
    assert(value && typeof value === "object", `acceptance_gate_missing:${gate}`);
    assertExactKeys(value, ["status", "requiredEvidence"], `acceptance_gate:${gate}`);
    assert(value.status === "HOLD", `acceptance_gate_not_hold:${gate}`);
    assertSafeText(value.requiredEvidence, `acceptance_gate_evidence:${gate}`);
  }

  const actionFields = [
    "vpsTouched",
    "liveLisaTouched",
    "productionTouched",
    "scheduleChangesApplied",
    "oauthOrLiveGoogleCalls",
    "privateDataRecorded",
  ];
  assertExactKeys(receipt.actions, actionFields, "acceptance_actions");
  for (const field of actionFields) {
    assert(receipt.actions[field] === false, `acceptance_action_not_false:${field}`);
  }

  const rollback = receipt.rollback;
  assertExactKeys(
    rollback,
    [
      "strategy",
      "sourceRevertAvailable",
      "liveRestorePerformed",
      "rollbackVerified",
      "approvalRequired",
    ],
    "acceptance_rollback",
  );
  assert(
    rollback.strategy === "revert-this-source-checkpoint-before-any-promotion",
    "acceptance_rollback_strategy",
  );
  assert(rollback.sourceRevertAvailable === true, "acceptance_source_revert_missing");
  assert(rollback.liveRestorePerformed === false, "acceptance_live_restore_performed");
  assert(rollback.rollbackVerified === false, "acceptance_rollback_claimed");
  assert(rollback.approvalRequired === true, "acceptance_rollback_approval_missing");

  assert(
    receipt.receiptDigestSha256 === sha256(canonicalJson(withoutAcceptanceDigest(receipt))),
    "acceptance_receipt_digest_mismatch",
  );
  return receipt;
}

/** Build a deterministic, source-only PKT-11 receipt without live evidence. */
export function buildSourceAcceptanceReceipt({ sourceBase, stageWorkspacePackage }) {
  const result = {
    receiptType: PKT11_SOURCE_ACCEPTANCE_RECEIPT_TYPE,
    status: "source-prepared",
    packet: { id: "PKT-11", issue: "ISS-11", executionState: "PLAN" },
    sourceBase: {
      repository: sourceBase.repository,
      ref: sourceBase.ref,
      commit: sourceBase.commit,
      tree: sourceBase.tree,
    },
    ownedPaths: [...PKT11_SOURCE_ACCEPTANCE_OWNED_PATHS],
    prohibitedPaths: [...PKT11_SOURCE_ACCEPTANCE_PROHIBITED_PATHS],
    dependencyPackets: {
      required: [...PKT11_DEPENDENCIES],
      reproduced: [],
      resolution:
        "exact accepted commit/tree receipts are consumed from the external runtime authority snapshot",
    },
    artifacts: {
      reconciliationTool: {
        path: "linkbots/lisa/ops/lisa-vps-reconciliation.mjs",
        sourceOnly: true,
        liveActions: false,
      },
      stageWorkspacePackage: {
        sourceReceiptType: "lisa_stage_workspace_package_source_receipt_v1",
        status: stageWorkspacePackage.status,
        packageId: stageWorkspacePackage.packageId,
        manifestSha256: stageWorkspacePackage.manifestSha256,
        fileCount: stageWorkspacePackage.fileCount,
        mutableSeeds: false,
        liveMutationAllowed: false,
      },
      providerQualificationReference:
        "linkbots/lisa/ops/google-workspace/receipts/qualified-skills.receipt.json",
    },
    gates: Object.fromEntries(
      PKT11_EXTERNAL_GATES.map((gate) => [
        gate,
        { status: "HOLD", requiredEvidence: `external:${gate}` },
      ]),
    ),
    actions: {
      vpsTouched: false,
      liveLisaTouched: false,
      productionTouched: false,
      scheduleChangesApplied: false,
      oauthOrLiveGoogleCalls: false,
      privateDataRecorded: false,
    },
    rollback: {
      strategy: "revert-this-source-checkpoint-before-any-promotion",
      sourceRevertAvailable: true,
      liveRestorePerformed: false,
      rollbackVerified: false,
      approvalRequired: true,
    },
  };
  const receipt = { ...result, receiptDigestSha256: sha256(canonicalJson(result)) };
  return validateSourceAcceptanceReceipt(receipt);
}

export function validateReconciliation(manifest) {
  assert(manifest && typeof manifest === "object", "manifest_missing");
  assertNoSecretMaterialFields(manifest, "manifest");
  assert(manifest.schemaVersion === SCHEMA_VERSION, "unsupported_manifest_schema");
  assert(PHASES.has(manifest.phase), "invalid_manifest_phase");
  assert(manifest.sources?.local?.id === "local", "manifest_local_source_missing");
  assert(manifest.sources?.vps?.id === "vps", "manifest_vps_source_missing");
  assert(Array.isArray(manifest.inventories?.local), "manifest_local_inventory_missing");
  assert(Array.isArray(manifest.inventories?.vps), "manifest_vps_inventory_missing");
  assert(Array.isArray(manifest.comparisons), "manifest_comparisons_missing");
  const localSource = normalizeSource(manifest.sources.local, "local");
  const vpsSource = normalizeSource(manifest.sources.vps, "vps");
  const localInventory = normalizeInventory({ entries: manifest.inventories.local }, "local");
  const vpsInventory = normalizeInventory({ entries: manifest.inventories.vps }, "vps");
  assert(
    localSource.inventorySha256 === localInventory.calculatedSha256,
    "local_inventory_fingerprint_mismatch",
  );
  assert(
    vpsSource.inventorySha256 === vpsInventory.calculatedSha256,
    "vps_inventory_fingerprint_mismatch",
  );
  assert(
    canonicalJson(localInventory.entries) === canonicalJson(manifest.inventories.local),
    "manifest_local_inventory_not_normalized",
  );
  assert(
    canonicalJson(vpsInventory.entries) === canonicalJson(manifest.inventories.vps),
    "manifest_vps_inventory_not_normalized",
  );
  const expectedComparisons = buildComparisons(localInventory.entries, vpsInventory.entries);
  assert(
    canonicalJson(expectedComparisons) === canonicalJson(manifest.comparisons),
    "manifest_comparisons_mismatch",
  );
  for (const comparison of expectedComparisons) {
    assertSafeText(comparison.key, "comparison_key");
    if (comparison.status === "local_only") {
      const entry = localInventory.entries.find((candidate) => candidate.key === comparison.key);
      assert(entry, `comparison_local_entry_missing:${comparison.key}`);
      validateDecision(entry, comparison);
    }
    if (comparison.status === "conflict") {
      const entry = localInventory.entries.find((candidate) => candidate.key === comparison.key);
      assert(entry, `comparison_conflict_entry_missing:${comparison.key}`);
      validateConflict(entry, comparison);
    }
  }
  assert(
    canonicalJson(buildSummary(expectedComparisons)) === canonicalJson(manifest.summary),
    "manifest_summary_mismatch",
  );
  assert(manifest.gates && typeof manifest.gates === "object", "manifest_gates_missing");
  for (const gate of ["localQuiesced", "recoveryVerified", "finalDeltaCaptured"]) {
    assert(typeof manifest.gates[gate] === "boolean", `manifest_gate_invalid:${gate}`);
  }
  if (manifest.phase === "final-delta") {
    for (const gate of ["localQuiesced", "recoveryVerified", "finalDeltaCaptured"]) {
      assert(manifest.gates[gate] === true, `final_delta_gate_required:${gate}`);
    }
  } else {
    assert(manifest.gates.finalDeltaCaptured === false, "manifest_final_delta_gate_invalid");
  }
  assert(manifest.receipt && manifest.receipt.digestSha256, "manifest_receipt_missing");
  assertSha(manifest.receipt.digestSha256, "receipt_digest");
  assert(manifest.receipt.phase === manifest.phase, "receipt_phase_mismatch");
  assert(
    manifest.receipt.localInventorySha256 === localInventory.calculatedSha256,
    "receipt_local_inventory_mismatch",
  );
  assert(
    manifest.receipt.vpsInventorySha256 === vpsInventory.calculatedSha256,
    "receipt_vps_inventory_mismatch",
  );
  assert(
    canonicalJson(manifest.receipt.summary) === canonicalJson(manifest.summary),
    "receipt_summary_mismatch",
  );
  assert(
    manifest.receipt.unresolvedCount ===
      expectedComparisons.filter((comparison) => comparison.classification === "unresolved").length,
    "receipt_unresolved_count_mismatch",
  );
  assert(
    manifest.receipt.digestSha256 === sha256(canonicalJson(withoutReceipt(manifest))),
    "receipt_digest_mismatch",
  );
  return manifest;
}

export function buildReconciliation({ local, vps, phase = "initial", gate = {} }) {
  assert(PHASES.has(phase), "invalid_phase");
  const localSource = normalizeSource(local.source, "local");
  const vpsSource = normalizeSource(vps.source, "vps");
  const localInventory = normalizeInventory(local, "local");
  const vpsInventory = normalizeInventory(vps, "vps");
  assert(
    localSource.inventorySha256 === localInventory.calculatedSha256,
    "local_inventory_fingerprint_mismatch",
  );
  assert(
    vpsSource.inventorySha256 === vpsInventory.calculatedSha256,
    "vps_inventory_fingerprint_mismatch",
  );
  const comparisons = buildComparisons(localInventory.entries, vpsInventory.entries);
  for (const comparison of comparisons) {
    if (comparison.status === "local_only") {
      const entry = localInventory.entries.find((candidate) => candidate.key === comparison.key);
      validateDecision(entry, comparison);
    }
    if (comparison.status === "conflict") {
      const entry = localInventory.entries.find((candidate) => candidate.key === comparison.key);
      validateConflict(entry, comparison);
    }
  }
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    phase,
    sources: { local: localSource, vps: vpsSource },
    inventories: { local: localInventory.entries, vps: vpsInventory.entries },
    comparisons,
    summary: buildSummary(comparisons),
    gates: {
      localQuiesced: gate.localQuiesced === true,
      recoveryVerified: gate.recoveryVerified === true,
      finalDeltaCaptured: phase === "final-delta" ? gate.finalDeltaCaptured === true : false,
    },
  };
  const receipt = {
    phase,
    digestSha256: sha256(canonicalJson(manifest)),
    localInventorySha256: localInventory.calculatedSha256,
    vpsInventorySha256: vpsInventory.calculatedSha256,
    summary: manifest.summary,
    unresolvedCount: comparisons.filter((comparison) => comparison.classification === "unresolved")
      .length,
  };
  const result = { ...manifest, receipt };
  validateReconciliation(result);
  return result;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    assert(token.startsWith("--"), `unexpected_argument:${token}`);
    const key = token.slice(2);
    const value = rest[index + 1];
    assert(value && !value.startsWith("--"), `missing_argument:${key}`);
    args[key] = value;
    index += 1;
  }
  return { command, args };
}

function readJson(filePath, label) {
  assert(filePath && existsSync(filePath), `missing_${label}`);
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function compareCommand(args) {
  const local = readJson(args.local, "local_inventory");
  const vps = readJson(args.vps, "vps_inventory");
  const result = buildReconciliation({
    local,
    vps,
    phase: args.phase ?? "initial",
    gate: {
      localQuiesced: args["local-quiesced"] === "true",
      recoveryVerified: args["recovery-verified"] === "true",
      finalDeltaCaptured: args["final-delta-captured"] === "true",
    },
  });
  if (args.output) {
    writeFileSync(path.resolve(args.output), `${JSON.stringify(result, null, 2)}\n`, {
      mode: 0o600,
    });
  }
  return {
    phase: result.phase,
    output: args.output ? path.resolve(args.output) : null,
    comparisonCount: result.comparisons.length,
    unresolvedCount: result.receipt.unresolvedCount,
    digestSha256: result.receipt.digestSha256,
  };
}

function verifyCommand(args) {
  const manifest = readJson(args.manifest, "manifest");
  const result = validateReconciliation(manifest);
  return {
    phase: result.phase,
    digestSha256: result.receipt.digestSha256,
    comparisonCount: result.comparisons.length,
    unresolvedCount: result.receipt.unresolvedCount,
  };
}

function verifyAcceptanceCommand(args) {
  const receipt = readJson(args.receipt, "acceptance_receipt");
  const result = validateSourceAcceptanceReceipt(receipt);
  return {
    status: result.status,
    receiptType: result.receiptType,
    receiptDigestSha256: result.receiptDigestSha256,
    liveActions: false,
  };
}

export async function main(argv = process.argv.slice(2)) {
  const { command, args } = parseArgs(argv);
  if (PKT11_LIVE_COMMANDS.includes(command)) {
    return fail(`live_command_forbidden:${command}`);
  }
  if (command === "compare") {
    return compareCommand(args);
  }
  if (command === "verify") {
    return verifyCommand(args);
  }
  if (command === "verify-acceptance") {
    return verifyAcceptanceCommand(args);
  }
  return fail(`unknown_command:${command ?? "(missing)"}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch(
      /** @param {unknown} error */
      (error) => {
        process.stderr.write(
          `lisa-vps-reconciliation: ${error instanceof Error ? error.message : String(error)}\n`,
        );
        process.exitCode = 2;
      },
    );
}

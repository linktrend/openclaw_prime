/**
 * Stage workspace package installer — bounded stable procedures + renderer
 * dependencies + stage Google/task adapters.
 *
 * Default: verify SHA256 against manifest and write a receipt. NEVER mutates the
 * real LiNKplatform-staging lisa workspace. Optional --target only for hermetic
 * temp dirs / Principal-gated installs. --emit-commands prints a copy plan.
 *
 * The checked-in package contains no mutable/private runtime seeds. Any
 * Personality-files source must be listed by the canonical profile manifest.
 */

import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { STAGE_OPS_STAGE_ROOT } from "./stage-ops-command.ts";

export const STAGE_WORKSPACE_PACKAGE_RECEIPT_TYPE =
  "lisa_stage_workspace_package_receipt_v1" as const;
export const STAGE_WORKSPACE_PACKAGE_SOURCE_RECEIPT_TYPE =
  "lisa_stage_workspace_package_source_receipt_v1" as const;

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MANIFEST_PATH = path.join(here, "stage-workspace-package.manifest.json");
/** Repo source root: linkbots/lisa */
export const DEFAULT_SOURCE_ROOT = path.resolve(here, "..");
export const PROFILE_BUNDLE_MANIFEST_PATH = path.join(
  DEFAULT_SOURCE_ROOT,
  "PROFILE_BUNDLE_MANIFEST.json",
);

export const FORBIDDEN_STAGE_WORKSPACE = path.join(STAGE_OPS_STAGE_ROOT, "workspace");

/** Live Lisa hard-stop paths — never install here. */
export const FORBIDDEN_LIVE_LISA_PREFIXES = [
  path.resolve("/Users/linktrend/.openclaw-lisa"),
] as const;

export type StageWorkspacePackageManifestFile = {
  source: string;
  destination: string;
  sha256: string;
  bytes: number;
};

export type StageWorkspacePackageManifest = {
  manifestType: "lisa_stage_workspace_package_v1";
  packageId: string;
  description: string;
  sourceRoot: string;
  liveMutationAllowed: false;
  defaultMutateStageWorkspace: false;
  files: StageWorkspacePackageManifestFile[];
  /** Legacy-compatible field; the current stable package requires this to remain empty. */
  initializeIfMissing?: StageWorkspacePackageManifestFile[];
};

export type StageWorkspaceFileVerification = {
  source: string;
  destination: string;
  expectedSha256: string;
  actualSha256: string | null;
  expectedBytes: number;
  actualBytes: number | null;
  ok: boolean;
  mode: "overwrite" | "initialize_if_missing";
  error?: string;
};

export type StageWorkspacePackageReceipt = {
  receiptType: typeof STAGE_WORKSPACE_PACKAGE_RECEIPT_TYPE;
  packageId: string;
  timestamp: string;
  status:
    | "verified"
    | "installed"
    | "commands_emitted"
    | "blocked_forbidden_target"
    | "hash_mismatch";
  mutateWorkspace: boolean;
  targetDir: string | null;
  sourceRoot: string;
  liveLisaTouched: false;
  stageWorkspaceMutated: false | true;
  files: StageWorkspaceFileVerification[];
  copyCommands: string[];
  installedPaths: string[];
  preservedPaths: string[];
  initializedPaths: string[];
  hardStops: {
    defaultMutateStageWorkspace: false;
    liveMutationAllowed: false;
  };
};

/**
 * Stable source evidence for an integration packet. Unlike the operational
 * receipt below, this contains no timestamp, absolute path, or target state.
 */
export type StageWorkspacePackageSourceReceipt = {
  receiptType: typeof STAGE_WORKSPACE_PACKAGE_SOURCE_RECEIPT_TYPE;
  status: "verified-source" | "blocked-hash-mismatch";
  packageId: string;
  manifestSha256: string;
  fileCount: number;
  mutableSeeds: false;
  liveMutationAllowed: false;
  defaultMutateStageWorkspace: false;
  sourceRoot: "linkbots/lisa";
};

function allManifestEntries(
  manifest: StageWorkspacePackageManifest,
): Array<StageWorkspacePackageManifestFile & { mode: "overwrite" | "initialize_if_missing" }> {
  const overwrite = manifest.files.map((f) => ({ ...f, mode: "overwrite" as const }));
  const init = (manifest.initializeIfMissing ?? []).map((f) => ({
    ...f,
    mode: "initialize_if_missing" as const,
  }));
  return [...overwrite, ...init];
}

export function loadStageWorkspacePackageManifest(
  manifestPath: string = DEFAULT_MANIFEST_PATH,
): StageWorkspacePackageManifest {
  const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as StageWorkspacePackageManifest;
  if (raw.manifestType !== "lisa_stage_workspace_package_v1") {
    throw new Error(`unexpected manifestType: ${String(raw.manifestType)}`);
  }
  if (!Array.isArray(raw.files) || raw.files.length === 0) {
    throw new Error("manifest.files must be a non-empty array");
  }
  if (raw.initializeIfMissing !== undefined && !Array.isArray(raw.initializeIfMissing)) {
    throw new Error("manifest.initializeIfMissing must be an array when present");
  }
  if ((raw.initializeIfMissing ?? []).length !== 0) {
    throw new Error("stable stage workspace package must not include mutable runtime seeds");
  }
  const profileManifest = JSON.parse(readFileSync(PROFILE_BUNDLE_MANIFEST_PATH, "utf8")) as {
    requiredStableDefinition?: Array<{ path?: string }>;
    intentionalAssets?: Array<{ path?: string; deploymentRequired?: boolean }>;
  };
  const approvedProfileSources = new Set([
    ...(profileManifest.requiredStableDefinition ?? []).map((entry) => entry.path),
    ...(profileManifest.intentionalAssets ?? [])
      .filter((entry) => entry.deploymentRequired === true)
      .map((entry) => entry.path),
  ]);
  for (const entry of raw.files) {
    assertSafePackagePath(entry.source, "manifest source");
    assertSafePackagePath(entry.destination, "manifest destination");
    if (
      entry.source.startsWith("Personality files/") &&
      !approvedProfileSources.has(entry.source)
    ) {
      throw new Error(`stage package references excluded profile source: ${entry.source}`);
    }
  }
  for (const entry of raw.initializeIfMissing ?? []) {
    assertSafePackagePath(entry.source, "manifest source");
    assertSafePackagePath(entry.destination, "manifest destination");
  }
  return raw;
}

function assertSafePackagePath(value: string, field: string): void {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    path.isAbsolute(value) ||
    value.split(/[\\/]+/u).some((part) => part === "..")
  ) {
    throw new Error(`${field} must be a relative non-traversing path`);
  }
}

/** Stable manifest bytes used for disposable-package evidence. */
export function canonicalStageWorkspacePackageManifestBytes(
  manifest: StageWorkspacePackageManifest = loadStageWorkspacePackageManifest(),
): string {
  return JSON.stringify({
    manifestType: manifest.manifestType,
    packageId: manifest.packageId,
    description: manifest.description,
    sourceRoot: manifest.sourceRoot,
    liveMutationAllowed: manifest.liveMutationAllowed,
    defaultMutateStageWorkspace: manifest.defaultMutateStageWorkspace,
    files: allManifestEntries(manifest).map((entry) => ({
      source: entry.source,
      destination: entry.destination,
      sha256: entry.sha256,
      bytes: entry.bytes,
      mode: entry.mode,
    })),
  });
}

export function hashStageWorkspacePackageManifest(
  manifest: StageWorkspacePackageManifest = loadStageWorkspacePackageManifest(),
): string {
  return createHash("sha256")
    .update(canonicalStageWorkspacePackageManifestBytes(manifest))
    .digest("hex");
}

/** Build deterministic source evidence suitable for a committed packet receipt. */
export function buildStageWorkspacePackageSourceReceipt(
  params: {
    manifest?: StageWorkspacePackageManifest;
    manifestPath?: string;
    sourceRoot?: string;
  } = {},
): StageWorkspacePackageSourceReceipt {
  const manifest =
    params.manifest ??
    loadStageWorkspacePackageManifest(params.manifestPath ?? DEFAULT_MANIFEST_PATH);
  const verification = verifyStageWorkspacePackage({
    manifest,
    sourceRoot: params.sourceRoot,
  });
  return {
    receiptType: STAGE_WORKSPACE_PACKAGE_SOURCE_RECEIPT_TYPE,
    status: verification.ok ? "verified-source" : "blocked-hash-mismatch",
    packageId: manifest.packageId,
    manifestSha256: hashStageWorkspacePackageManifest(manifest),
    fileCount: manifest.files.length,
    mutableSeeds: false,
    liveMutationAllowed: false,
    defaultMutateStageWorkspace: false,
    sourceRoot: "linkbots/lisa",
  };
}

export function sha256File(filePath: string): { sha256: string; bytes: number } {
  const buf = readFileSync(filePath);
  return {
    sha256: createHash("sha256").update(buf).digest("hex"),
    bytes: buf.length,
  };
}

/**
 * PKT-11 pre-VPS qualification is deliberately narrower than deployment. The
 * harness may copy only into a caller-created disposable directory and records
 * no target path, network result, credential, or live state.
 */
export const PKT11_PRE_VPS_QUALIFICATION_RECEIPT_TYPE =
  "lisa_pkt_11_pre_vps_qualification_receipt_v1" as const;
export const PKT11_PRE_VPS_QUALIFICATION_SCHEMA_PATH =
  "linkbots/lisa/ops/receipts/pkt-11-pre-vps-qualification.schema.json";
const PKT11_PRE_VPS_QUALIFICATION_SCHEMA_FILE = path.join(
  here,
  "receipts/pkt-11-pre-vps-qualification.schema.json",
);

const PKT11_PRE_VPS_EXTERNAL_GATES = [
  "providerReleaseSetAccepted",
  "independentTerraVerification",
  "independentReview",
  "stageDeployment",
  "vpsDeployment",
  "productionCanary",
  "principalAcceptance",
  "rollbackVerification",
] as const;

const PKT11_PRE_VPS_ACTION_FIELDS = [
  "vpsTouched",
  "liveLisaTouched",
  "productionTouched",
  "scheduleChangesApplied",
  "oauthOrLiveGoogleCalls",
  "privateDataRecorded",
] as const;

const PKT11_PRE_VPS_ROOT_KEYS = [
  "receiptType",
  "status",
  "packet",
  "sourceBase",
  "package",
  "offlineCanary",
  "rollback",
  "gates",
  "actions",
  "receiptDigestSha256",
] as const;

const PKT11_PRE_VPS_PACKET_KEYS = ["id", "issue", "executionState"] as const;
const PKT11_PRE_VPS_SOURCE_BASE_KEYS = ["repository", "ref", "commit", "tree"] as const;
const PKT11_PRE_VPS_PACKAGE_KEYS = [
  "packageId",
  "manifestSha256",
  "fileCount",
  "status",
  "mutableSeeds",
  "liveMutationAllowed",
] as const;
const PKT11_PRE_VPS_CANARY_KEYS = [
  "status",
  "packageStatus",
  "networkAccess",
  "delivery",
  "oauthEnabled",
  "schedulesEnabled",
  "liveMutationAllowed",
  "liveLisaTouched",
  "stageWorkspaceMutated",
  "installedFileCount",
] as const;
const PKT11_PRE_VPS_ROLLBACK_KEYS = [
  "status",
  "strategy",
  "installedFileCount",
  "removedFileCount",
  "liveRestorePerformed",
  "rollbackVerified",
  "approvalRequired",
] as const;
const PKT11_PRE_VPS_LIVE_COMMANDS = new Set([
  "deploy",
  "canary",
  "ssh",
  "restore",
  "promote",
  "schedule",
  "oauth",
]);

export type Pkt11OfflineCanaryConfig = {
  targetDir: string;
  outputDir: string;
  sourceRoot?: string;
  action: "install";
  networkAccess: "disabled";
  delivery: "none";
  oauthEnabled: false;
  schedulesEnabled: false;
  liveMutationAllowed: false;
};

export type Pkt11OfflineCanaryResult = {
  status: "passed";
  packageStatus: "installed";
  networkAccess: "disabled";
  delivery: "none";
  oauthEnabled: false;
  schedulesEnabled: false;
  liveMutationAllowed: false;
  liveLisaTouched: false;
  stageWorkspaceMutated: false;
  installedFileCount: number;
};

export type Pkt11OfflineRollbackEvidence = {
  status: "verified-offline";
  strategy: "discard-hermetic-target";
  installedFileCount: number;
  removedFileCount: number;
  liveRestorePerformed: false;
  rollbackVerified: true;
  approvalRequired: true;
};

function preVpsFail(code: string): never {
  throw new Error(`pkt11_pre_vps_${code}`);
}

function assertExactKeys(value: object, keys: readonly string[], code: string): void {
  const actual = Object.keys(value).toSorted().join("\0");
  const expected = [...keys].toSorted().join("\0");
  if (actual !== expected) preVpsFail(code);
}

function assertPreVpsSchemaContract(): void {
  if (!existsSync(PKT11_PRE_VPS_QUALIFICATION_SCHEMA_FILE)) {
    preVpsFail("schema_missing");
  }
  const schema = JSON.parse(readFileSync(PKT11_PRE_VPS_QUALIFICATION_SCHEMA_FILE, "utf8")) as {
    $id?: string;
    additionalProperties?: boolean;
    properties?: { receiptType?: { const?: string }; status?: { const?: string } };
  };
  if (schema.$id !== "https://openclaw.local/schemas/lisa/pkt-11-pre-vps-qualification-v1.json") {
    preVpsFail("schema_id");
  }
  if (schema.additionalProperties !== false) preVpsFail("schema_open");
  if (schema.properties?.receiptType?.const !== PKT11_PRE_VPS_QUALIFICATION_RECEIPT_TYPE) {
    preVpsFail("schema_receipt_type");
  }
  if (schema.properties?.status?.const !== "offline-qualified") preVpsFail("schema_status");
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function isGitSha(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
}

function containsSensitiveKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSensitiveKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) =>
    /token|secret|password|private.?key|oauth|credential|cookie|message|email/iu.test(key) &&
    !(typeof child === "boolean" && child === false)
      ? true
      : containsSensitiveKey(child),
  );
}

/** Validate the only configuration shape accepted by the offline harness. */
export function validatePkt11OfflineCanaryConfig(
  config: Pkt11OfflineCanaryConfig,
): Pkt11OfflineCanaryConfig {
  if (!config || typeof config !== "object") preVpsFail("config_missing");
  if (config.action !== "install") preVpsFail("config_action");
  if (config.networkAccess !== "disabled") preVpsFail("config_network");
  if (config.delivery !== "none") preVpsFail("config_delivery");
  if (config.oauthEnabled !== false) preVpsFail("config_oauth");
  if (config.schedulesEnabled !== false) preVpsFail("config_schedules");
  if (config.liveMutationAllowed !== false) preVpsFail("config_live_mutation");
  if (typeof config.targetDir !== "string" || typeof config.outputDir !== "string") {
    preVpsFail("config_paths");
  }
  if (!path.isAbsolute(config.targetDir) || !path.isAbsolute(config.outputDir)) {
    preVpsFail("config_absolute_paths");
  }
  if (config.sourceRoot !== undefined && typeof config.sourceRoot !== "string") {
    preVpsFail("config_source_path");
  }
  const sourceRoot = path.resolve(config.sourceRoot ?? DEFAULT_SOURCE_ROOT);
  const targetDir = path.resolve(config.targetDir);
  const outputDir = path.resolve(config.outputDir);
  if (
    targetDir === sourceRoot ||
    targetDir.startsWith(`${sourceRoot}${path.sep}`) ||
    outputDir === sourceRoot ||
    outputDir.startsWith(`${sourceRoot}${path.sep}`) ||
    targetDir === outputDir ||
    targetDir.startsWith(`${outputDir}${path.sep}`) ||
    outputDir.startsWith(`${targetDir}${path.sep}`)
  ) {
    preVpsFail("config_source_or_nested_paths");
  }
  if (
    isForbiddenLiveLisaTarget(config.targetDir) ||
    isForbiddenStageWorkspaceTarget(config.targetDir)
  ) {
    preVpsFail("config_forbidden_target");
  }
  if (
    isForbiddenLiveLisaTarget(config.outputDir) ||
    isForbiddenStageWorkspaceTarget(config.outputDir)
  ) {
    preVpsFail("config_forbidden_output");
  }
  if (config.sourceRoot && isForbiddenLiveLisaTarget(config.sourceRoot)) {
    preVpsFail("config_forbidden_source");
  }
  return config;
}

/** Execute the package only against the caller's disposable target. */
export function runPkt11OfflineCanary(config: Pkt11OfflineCanaryConfig): Pkt11OfflineCanaryResult {
  validatePkt11OfflineCanaryConfig(config);
  const receipt = planStageWorkspacePackage({
    action: config.action,
    targetDir: config.targetDir,
    outputDir: config.outputDir,
    sourceRoot: config.sourceRoot,
  });
  if (
    receipt.status !== "installed" ||
    receipt.liveLisaTouched !== false ||
    receipt.stageWorkspaceMutated !== false ||
    receipt.initializedPaths.length !== 0 ||
    receipt.files.some((file) => !file.ok)
  ) {
    preVpsFail("offline_canary_not_verified");
  }
  return {
    status: "passed",
    packageStatus: receipt.status,
    networkAccess: "disabled",
    delivery: "none",
    oauthEnabled: false,
    schedulesEnabled: false,
    liveMutationAllowed: false,
    liveLisaTouched: false,
    stageWorkspaceMutated: false,
    installedFileCount: receipt.installedPaths.length,
  };
}

/** Assemble path-free rollback evidence after a disposable target is removed. */
export function buildPkt11OfflineRollbackEvidence(input: {
  installedFileCount: number;
  removedFileCount: number;
}): Pkt11OfflineRollbackEvidence {
  if (
    !Number.isSafeInteger(input.installedFileCount) ||
    input.installedFileCount <= 0 ||
    input.removedFileCount !== input.installedFileCount
  ) {
    preVpsFail("rollback_not_verified");
  }
  return {
    status: "verified-offline",
    strategy: "discard-hermetic-target",
    installedFileCount: input.installedFileCount,
    removedFileCount: input.removedFileCount,
    liveRestorePerformed: false,
    rollbackVerified: true,
    approvalRequired: true,
  };
}

export type Pkt11PreVpsQualificationReceipt = {
  receiptType: typeof PKT11_PRE_VPS_QUALIFICATION_RECEIPT_TYPE;
  status: "offline-qualified";
  packet: { id: "PKT-11"; issue: "ISS-11"; executionState: "PLAN" };
  sourceBase: {
    repository: "openclaw/openclaw";
    ref: "origin/development";
    commit: string;
    tree: string;
  };
  package: {
    packageId: string;
    manifestSha256: string;
    fileCount: number;
    status: "verified-source";
    mutableSeeds: false;
    liveMutationAllowed: false;
  };
  offlineCanary: Pkt11OfflineCanaryResult;
  rollback: Pkt11OfflineRollbackEvidence;
  gates: Record<
    (typeof PKT11_PRE_VPS_EXTERNAL_GATES)[number],
    { status: "HOLD"; requiredEvidence: string }
  >;
  actions: Record<(typeof PKT11_PRE_VPS_ACTION_FIELDS)[number], false>;
  receiptDigestSha256: string;
};

function withoutPreVpsDigest(
  receipt: Pkt11PreVpsQualificationReceipt,
): Omit<Pkt11PreVpsQualificationReceipt, "receiptDigestSha256"> {
  const { receiptDigestSha256: _digest, ...payload } = receipt;
  return payload;
}

function canonicalPreVpsJson(value: unknown): string {
  return JSON.stringify(value);
}

/** Fail-closed validator for the sanitized, source-only qualification receipt. */
export function validatePkt11PreVpsQualificationReceipt(
  receipt: Pkt11PreVpsQualificationReceipt,
): Pkt11PreVpsQualificationReceipt {
  assertPreVpsSchemaContract();
  if (!receipt || typeof receipt !== "object" || containsSensitiveKey(receipt)) {
    preVpsFail("receipt_sensitive_or_missing");
  }
  assertExactKeys(receipt, PKT11_PRE_VPS_ROOT_KEYS, "receipt_keys");
  if (receipt.receiptType !== PKT11_PRE_VPS_QUALIFICATION_RECEIPT_TYPE) {
    preVpsFail("receipt_type");
  }
  if (receipt.status !== "offline-qualified") preVpsFail("receipt_status");
  assertExactKeys(receipt.packet, PKT11_PRE_VPS_PACKET_KEYS, "receipt_packet_keys");
  if (
    receipt.packet.id !== "PKT-11" ||
    receipt.packet.issue !== "ISS-11" ||
    receipt.packet.executionState !== "PLAN"
  ) {
    preVpsFail("receipt_packet");
  }
  assertExactKeys(receipt.sourceBase, PKT11_PRE_VPS_SOURCE_BASE_KEYS, "receipt_source_base_keys");
  if (
    receipt.sourceBase.repository !== "openclaw/openclaw" ||
    receipt.sourceBase.ref !== "origin/development" ||
    !isGitSha(receipt.sourceBase.commit) ||
    !isGitSha(receipt.sourceBase.tree)
  ) {
    preVpsFail("receipt_source_base");
  }
  const pkg = receipt.package;
  assertExactKeys(pkg, PKT11_PRE_VPS_PACKAGE_KEYS, "receipt_package_keys");
  if (
    !pkg ||
    typeof pkg.packageId !== "string" ||
    !isSha256(pkg.manifestSha256) ||
    !Number.isSafeInteger(pkg.fileCount) ||
    pkg.fileCount <= 0 ||
    pkg.status !== "verified-source" ||
    pkg.mutableSeeds !== false ||
    pkg.liveMutationAllowed !== false
  ) {
    preVpsFail("receipt_package");
  }
  const canary = receipt.offlineCanary;
  assertExactKeys(canary, PKT11_PRE_VPS_CANARY_KEYS, "receipt_canary_keys");
  if (
    !canary ||
    canary.status !== "passed" ||
    canary.packageStatus !== "installed" ||
    canary.networkAccess !== "disabled" ||
    canary.delivery !== "none" ||
    canary.oauthEnabled !== false ||
    canary.schedulesEnabled !== false ||
    canary.liveMutationAllowed !== false ||
    canary.liveLisaTouched !== false ||
    canary.stageWorkspaceMutated !== false ||
    canary.installedFileCount !== pkg.fileCount
  ) {
    preVpsFail("receipt_canary");
  }
  const rollback = receipt.rollback;
  assertExactKeys(rollback, PKT11_PRE_VPS_ROLLBACK_KEYS, "receipt_rollback_keys");
  if (
    !rollback ||
    rollback.status !== "verified-offline" ||
    rollback.strategy !== "discard-hermetic-target" ||
    rollback.installedFileCount !== pkg.fileCount ||
    rollback.removedFileCount !== pkg.fileCount ||
    rollback.liveRestorePerformed !== false ||
    rollback.rollbackVerified !== true ||
    rollback.approvalRequired !== true
  ) {
    preVpsFail("receipt_rollback");
  }
  if (
    !receipt.gates ||
    Object.keys(receipt.gates).toSorted().join("\0") !==
      [...PKT11_PRE_VPS_EXTERNAL_GATES].toSorted().join("\0")
  ) {
    preVpsFail("receipt_gates");
  }
  for (const gate of PKT11_PRE_VPS_EXTERNAL_GATES) {
    if (
      receipt.gates[gate]?.status !== "HOLD" ||
      typeof receipt.gates[gate].requiredEvidence !== "string"
    ) {
      preVpsFail(`receipt_gate:${gate}`);
    }
    assertExactKeys(receipt.gates[gate], ["status", "requiredEvidence"], `receipt_gate_keys:${gate}`);
  }
  if (
    !receipt.actions ||
    Object.keys(receipt.actions).toSorted().join("\0") !==
      [...PKT11_PRE_VPS_ACTION_FIELDS].toSorted().join("\0")
  ) {
    preVpsFail("receipt_actions");
  }
  for (const field of PKT11_PRE_VPS_ACTION_FIELDS) {
    if (receipt.actions[field] !== false) preVpsFail(`receipt_action:${field}`);
  }
  if (
    !isSha256(receipt.receiptDigestSha256) ||
    receipt.receiptDigestSha256 !==
      createHash("sha256")
        .update(canonicalPreVpsJson(withoutPreVpsDigest(receipt)))
        .digest("hex")
  ) {
    preVpsFail("receipt_digest");
  }
  return receipt;
}

/** Build a deterministic pre-VPS receipt; it contains no target path or live claim. */
export function buildPkt11PreVpsQualificationReceipt(input: {
  sourceBase: Pkt11PreVpsQualificationReceipt["sourceBase"];
  stageWorkspacePackage: {
    packageId: string;
    manifestSha256: string;
    fileCount: number;
    status: "verified-source";
  };
  offlineCanary: Pkt11OfflineCanaryResult;
  rollback: Pkt11OfflineRollbackEvidence;
}): Pkt11PreVpsQualificationReceipt {
  const result = {
    receiptType: PKT11_PRE_VPS_QUALIFICATION_RECEIPT_TYPE,
    status: "offline-qualified" as const,
    packet: { id: "PKT-11" as const, issue: "ISS-11" as const, executionState: "PLAN" as const },
    sourceBase: input.sourceBase,
    package: {
      packageId: input.stageWorkspacePackage.packageId,
      manifestSha256: input.stageWorkspacePackage.manifestSha256,
      fileCount: input.stageWorkspacePackage.fileCount,
      status: input.stageWorkspacePackage.status,
      mutableSeeds: false as const,
      liveMutationAllowed: false as const,
    },
    offlineCanary: input.offlineCanary,
    rollback: input.rollback,
    gates: Object.fromEntries(
      PKT11_PRE_VPS_EXTERNAL_GATES.map((gate) => [
        gate,
        { status: "HOLD" as const, requiredEvidence: `external:${gate}` },
      ]),
    ) as Pkt11PreVpsQualificationReceipt["gates"],
    actions: Object.fromEntries(
      PKT11_PRE_VPS_ACTION_FIELDS.map((field) => [field, false]),
    ) as Pkt11PreVpsQualificationReceipt["actions"],
  };
  const receipt = {
    ...result,
    receiptDigestSha256: createHash("sha256").update(canonicalPreVpsJson(result)).digest("hex"),
  } as Pkt11PreVpsQualificationReceipt;
  return validatePkt11PreVpsQualificationReceipt(receipt);
}

export function verifyStageWorkspacePackage(params: {
  manifest?: StageWorkspacePackageManifest;
  manifestPath?: string;
  sourceRoot?: string;
}): {
  ok: boolean;
  files: StageWorkspaceFileVerification[];
  manifest: StageWorkspacePackageManifest;
} {
  const manifest =
    params.manifest ??
    loadStageWorkspacePackageManifest(params.manifestPath ?? DEFAULT_MANIFEST_PATH);
  const sourceRoot = params.sourceRoot ?? DEFAULT_SOURCE_ROOT;
  const files: StageWorkspaceFileVerification[] = [];
  for (const entry of allManifestEntries(manifest)) {
    const abs = path.join(sourceRoot, entry.source);
    if (!existsSync(abs)) {
      files.push({
        source: entry.source,
        destination: entry.destination,
        expectedSha256: entry.sha256,
        actualSha256: null,
        expectedBytes: entry.bytes,
        actualBytes: null,
        ok: false,
        mode: entry.mode,
        error: "missing_source",
      });
      continue;
    }
    const { sha256, bytes } = sha256File(abs);
    const ok = sha256 === entry.sha256 && bytes === entry.bytes;
    files.push({
      source: entry.source,
      destination: entry.destination,
      expectedSha256: entry.sha256,
      actualSha256: sha256,
      expectedBytes: entry.bytes,
      actualBytes: bytes,
      ok,
      mode: entry.mode,
      error: ok ? undefined : "hash_or_size_mismatch",
    });
  }
  return { ok: files.every((f) => f.ok), files, manifest };
}

function resolveReal(p: string): string {
  const resolved = path.resolve(p);
  let ancestor = resolved;
  const suffix: string[] = [];

  // `realpathSync` only protects existing paths. For a target such as
  // `/tmp/link-to-live/new/workspace`, resolve its nearest existing ancestor
  // first, then reattach the missing tail so a symlink cannot hide live Lisa.
  while (!existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) {
      throw new Error(`cannot resolve existing ancestor for target: ${p}`);
    }
    suffix.unshift(path.basename(ancestor));
    ancestor = parent;
  }
  return path.resolve(realpathSync(ancestor), ...suffix);
}

/** True when target is (or is inside) the real stage workspace / stage root. */
export function isForbiddenStageWorkspaceTarget(targetDir: string): boolean {
  const target = resolveReal(targetDir);
  const stageRoot = resolveReal(STAGE_OPS_STAGE_ROOT);
  const stageWs = resolveReal(FORBIDDEN_STAGE_WORKSPACE);
  return (
    target === stageRoot ||
    target === stageWs ||
    target.startsWith(`${stageRoot}${path.sep}`) ||
    target.startsWith(`${stageWs}${path.sep}`)
  );
}

/** True when target is under live Lisa profile paths. */
export function isForbiddenLiveLisaTarget(targetDir: string): boolean {
  const target = resolveReal(targetDir);
  return FORBIDDEN_LIVE_LISA_PREFIXES.some(
    (prefix) => target === prefix || target.startsWith(`${prefix}${path.sep}`),
  );
}

function isBlockedTargetAction(action: "verify" | "install" | "emit-commands"): boolean {
  return action === "install" || action === "emit-commands";
}

function buildCopyCommands(
  manifest: StageWorkspacePackageManifest,
  sourceRoot: string,
  targetDir: string,
): string[] {
  const cmds: string[] = [];
  for (const f of manifest.files) {
    const src = path.join(sourceRoot, f.source);
    const dest = path.join(targetDir, f.destination);
    cmds.push(
      `mkdir -p ${shellQuote(path.dirname(dest))} && cp ${shellQuote(src)} ${shellQuote(dest)}`,
    );
  }
  for (const f of manifest.initializeIfMissing ?? []) {
    const src = path.join(sourceRoot, f.source);
    const dest = path.join(targetDir, f.destination);
    cmds.push(
      `mkdir -p ${shellQuote(path.dirname(dest))} && if [ ! -e ${shellQuote(dest)} ]; then cp ${shellQuote(src)} ${shellQuote(dest)}; fi`,
    );
  }
  return cmds;
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export function planStageWorkspacePackage(params: {
  action?: "verify" | "install" | "emit-commands";
  targetDir?: string | null;
  outputDir: string;
  sourceRoot?: string;
  manifestPath?: string;
  nowIso?: string;
  /** Principal-only escape hatch; still refused against real stage unless true. */
  allowForbiddenStageTarget?: boolean;
}): StageWorkspacePackageReceipt {
  const action = params.action ?? "verify";
  const sourceRoot = params.sourceRoot ?? DEFAULT_SOURCE_ROOT;
  const nowIso = params.nowIso ?? new Date().toISOString();
  const { ok, files, manifest } = verifyStageWorkspacePackage({
    manifestPath: params.manifestPath,
    sourceRoot,
  });

  const targetDir = params.targetDir ? resolveReal(params.targetDir) : null;
  const targetIsLiveLisa = targetDir !== null && isForbiddenLiveLisaTarget(targetDir);
  const targetIsForbiddenStage =
    targetDir !== null &&
    isForbiddenStageWorkspaceTarget(targetDir) &&
    !params.allowForbiddenStageTarget;
  // A live Lisa target must be rejected before command construction as well as
  // before installation. Emitting a command that names a live target is unsafe.
  const targetBlocked =
    targetDir !== null &&
    isBlockedTargetAction(action) &&
    (targetIsLiveLisa || targetIsForbiddenStage);
  const copyCommands = targetBlocked
    ? []
    : targetDir !== null
      ? buildCopyCommands(manifest, sourceRoot, targetDir)
      : buildCopyCommands(manifest, sourceRoot, "<TARGET_WORKSPACE>");

  const base = {
    receiptType: STAGE_WORKSPACE_PACKAGE_RECEIPT_TYPE,
    packageId: manifest.packageId,
    timestamp: nowIso,
    sourceRoot,
    liveLisaTouched: false as const,
    files,
    copyCommands,
    hardStops: {
      defaultMutateStageWorkspace: false as const,
      liveMutationAllowed: false as const,
    },
  };

  mkdirSync(params.outputDir, { recursive: true });

  if (!ok) {
    const receipt: StageWorkspacePackageReceipt = {
      ...base,
      status: "hash_mismatch",
      mutateWorkspace: false,
      targetDir,
      stageWorkspaceMutated: false,
      installedPaths: [],
      preservedPaths: [],
      initializedPaths: [],
    };
    writeReceipt(params.outputDir, receipt);
    return receipt;
  }

  if (targetBlocked) {
    const receipt: StageWorkspacePackageReceipt = {
      ...base,
      status: "blocked_forbidden_target",
      mutateWorkspace: false,
      targetDir,
      stageWorkspaceMutated: false,
      installedPaths: [],
      preservedPaths: [],
      initializedPaths: [],
    };
    writeReceipt(params.outputDir, receipt);
    return receipt;
  }

  if (action === "emit-commands") {
    const receipt: StageWorkspacePackageReceipt = {
      ...base,
      status: "commands_emitted",
      mutateWorkspace: false,
      targetDir,
      stageWorkspaceMutated: false,
      installedPaths: [],
      preservedPaths: [],
      initializedPaths: [],
    };
    writeReceipt(params.outputDir, receipt);
    return receipt;
  }

  if (action === "verify" || !targetDir) {
    const receipt: StageWorkspacePackageReceipt = {
      ...base,
      status: "verified",
      mutateWorkspace: false,
      targetDir,
      stageWorkspaceMutated: false,
      installedPaths: [],
      preservedPaths: [],
      initializedPaths: [],
    };
    writeReceipt(params.outputDir, receipt);
    return receipt;
  }

  const installedPaths: string[] = [];
  const preservedPaths: string[] = [];
  const initializedPaths: string[] = [];

  for (const entry of manifest.files) {
    const src = path.join(sourceRoot, entry.source);
    const dest = path.join(targetDir, entry.destination);
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    installedPaths.push(dest);
  }

  for (const entry of manifest.initializeIfMissing ?? []) {
    const src = path.join(sourceRoot, entry.source);
    const dest = path.join(targetDir, entry.destination);
    mkdirSync(path.dirname(dest), { recursive: true });
    if (existsSync(dest)) {
      preservedPaths.push(dest);
      continue;
    }
    copyFileSync(src, dest);
    initializedPaths.push(dest);
    installedPaths.push(dest);
  }

  const receipt: StageWorkspacePackageReceipt = {
    ...base,
    status: "installed",
    mutateWorkspace: true,
    targetDir,
    stageWorkspaceMutated: isForbiddenStageWorkspaceTarget(targetDir),
    installedPaths,
    preservedPaths,
    initializedPaths,
  };
  writeReceipt(params.outputDir, receipt);
  return receipt;
}

function writeReceipt(outputDir: string, receipt: StageWorkspacePackageReceipt): void {
  writeFileSync(
    path.join(outputDir, "stage-workspace-package-receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
    "utf8",
  );
}

function printHelp(): void {
  console.log(`Usage:
  node --experimental-strip-types linkbots/lisa/ops/stage-workspace-package.ts verify --out <dir>
  node --experimental-strip-types linkbots/lisa/ops/stage-workspace-package.ts emit-commands --out <dir> [--target <dir>]
  node --experimental-strip-types linkbots/lisa/ops/stage-workspace-package.ts install --out <dir> --target <hermetic-dir>
  node --experimental-strip-types linkbots/lisa/ops/stage-workspace-package.ts verify-pre-vps-receipt --receipt <path>

Default never writes to ${FORBIDDEN_STAGE_WORKSPACE}.
Mutable seeds initialize only when missing (preserve on reinstall).
Never installs under ~/.openclaw-lisa.
Live deploy, canary, restore, schedule, and OAuth commands are rejected.
`);
}

function main(argv: string[]): number {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    return 0;
  }
  const actionRaw = args[0];
  if (actionRaw && PKT11_PRE_VPS_LIVE_COMMANDS.has(actionRaw)) {
    console.error(`pkt11_pre_vps_live_command_forbidden:${actionRaw}`);
    return 2;
  }
  if (actionRaw === "verify-pre-vps-receipt") {
    const receiptIdx = args.indexOf("--receipt");
    const receiptPath = receiptIdx >= 0 ? args[receiptIdx + 1] : undefined;
    if (!receiptPath) {
      console.error("verify-pre-vps-receipt requires --receipt <path>");
      return 2;
    }
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as Pkt11PreVpsQualificationReceipt;
    validatePkt11PreVpsQualificationReceipt(receipt);
    console.log(
      JSON.stringify(
        {
          status: receipt.status,
          receiptType: receipt.receiptType,
          receiptDigestSha256: receipt.receiptDigestSha256,
          liveActions: false,
        },
        null,
        2,
      ),
    );
    return 0;
  }
  if (
    actionRaw !== "install" &&
    actionRaw !== "emit-commands" &&
    actionRaw !== "verify"
  ) {
    console.error(`pkt11_pre_vps_unknown_command:${actionRaw}`);
    return 2;
  }
  const action =
    actionRaw === "install"
      ? "install"
      : actionRaw === "emit-commands"
        ? "emit-commands"
        : "verify";
  const outIdx = args.indexOf("--out");
  const targetIdx = args.indexOf("--target");
  const outDir =
    outIdx >= 0 ? args[outIdx + 1]! : path.join(process.cwd(), "tmp-stage-workspace-package");
  const targetDir = targetIdx >= 0 ? args[targetIdx + 1]! : null;

  if (action === "install" && !targetDir) {
    console.error("install requires --target <dir>");
    return 2;
  }

  const receipt = planStageWorkspacePackage({
    action,
    targetDir,
    outputDir: outDir,
    allowForbiddenStageTarget: process.env.STAGE_WORKSPACE_PACKAGE_ALLOW_STAGE === "1",
  });

  if (args.includes("--emit-commands") || action === "emit-commands") {
    for (const cmd of receipt.copyCommands) {
      console.log(cmd);
    }
  }
  console.log(JSON.stringify(receipt, null, 2));

  if (receipt.status === "hash_mismatch" || receipt.status === "blocked_forbidden_target") {
    return 1;
  }
  return 0;
}

const isDirectCli =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectCli) {
  process.exitCode = main(process.argv);
}

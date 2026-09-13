import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA = "lisa_google_workspace_qualified_skills_receipt_v1";
const SHA256_RE = /^sha256:[0-9a-f]{64}$/u;
const RAW_SHA256_RE = /^[0-9a-f]{64}$/u;
const GIT_SHA_RE = /^[0-9a-f]{40}$/u;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function fail(reason) {
  return { ok: false, reason };
}

const RECEIPT_FIELDS = [
  "schema",
  "status",
  "provider",
  "catalogueBinding",
  "catalogueIndexBinding",
  "qualification",
  "retrieval",
  "skills",
  "unsupportedByDesign",
  "privacy",
];
const PROVIDER_FIELDS = ["repository", "commit", "tree", "releaseIdentity", "skillSetDigest"];
const CATALOGUE_FIELDS = [
  "repository",
  "path",
  "sha256",
  "requiredServices",
  "status",
  "providerRuntime",
];
const CATALOGUE_INDEX_FIELDS = [
  "repository",
  "path",
  "catalogueGitSha",
  "sourceTreeSha256",
  "sha256",
  "requiredSkillIds",
  "presentSkillIds",
  "status",
];
const QUALIFICATION_FIELDS = [
  "state",
  "reason",
  "exactReleaseRequired",
  "catalogueDigestRequired",
  "executionGate",
];
const RETRIEVAL_FIELDS = ["mode", "copiedSkillBodies", "localExecution", "providerRuntime"];
const SKILL_FIELDS = ["id", "source", "sha256"];
const PRIVACY_FIELDS = ["accountIdentifiers", "credentialValues", "liveGoogleCallsPerformed"];

function validateExactFields(value, fields, label) {
  if (!isRecord(value)) return null;
  const actual = new Set(Object.keys(value));
  for (const key of actual) {
    if (!fields.includes(key)) return fail(`${label}_unknown_field_${key}`);
  }
  for (const key of fields) {
    if (!actual.has(key)) return fail(`${label}_missing_field_${key}`);
  }
  return null;
}

function validateReceiptShape(receipt, label) {
  let result = validateExactFields(receipt, RECEIPT_FIELDS, `${label}_top_level`);
  if (result) return result;
  for (const [key, fields] of [
    ["provider", PROVIDER_FIELDS],
    ["catalogueBinding", CATALOGUE_FIELDS],
    ["catalogueIndexBinding", CATALOGUE_INDEX_FIELDS],
    ["qualification", QUALIFICATION_FIELDS],
    ["retrieval", RETRIEVAL_FIELDS],
    ["privacy", PRIVACY_FIELDS],
  ]) {
    result = validateExactFields(receipt[key], fields, `${label}_${key}`);
    if (result) return result;
  }
  if (Array.isArray(receipt.skills)) {
    for (let index = 0; index < receipt.skills.length; index += 1) {
      result = validateExactFields(receipt.skills[index], SKILL_FIELDS, `${label}_skills_${index}`);
      if (result) return result;
    }
  }
  return null;
}

/**
 * Validate the provider-supplied runtime receipt against the committed source
 * contract. A source-only or partially copied receipt never enables a wrapper.
 * This checks bytes and declared identities only; it does not qualify a provider.
 */
export function validateQualifiedSkillsReceipt(source, candidate) {
  if (!isRecord(source) || !isRecord(candidate)) return fail("receipt_not_object");
  if (source.schema !== SCHEMA || candidate.schema !== SCHEMA) return fail("schema_mismatch");
  const sourceShape = validateReceiptShape(source, "source");
  if (sourceShape) return sourceShape;
  const candidateShape = validateReceiptShape(candidate, "candidate");
  if (candidateShape) return candidateShape;
  if (source.status !== "qualification-required") return fail("source_status_mismatch");

  const sourceProvider = source.provider;
  const candidateProvider = candidate.provider;
  if (!isRecord(sourceProvider) || !isRecord(candidateProvider)) return fail("provider_missing");
  for (const key of ["repository", "commit", "tree", "releaseIdentity", "skillSetDigest"]) {
    if (candidateProvider[key] !== sourceProvider[key]) return fail(`provider_${key}_mismatch`);
  }
  if (!GIT_SHA_RE.test(candidateProvider.commit) || !GIT_SHA_RE.test(candidateProvider.tree)) {
    return fail("provider_pin_malformed");
  }
  if (!SHA256_RE.test(candidateProvider.skillSetDigest)) return fail("skill_set_digest_malformed");

  const sourceCatalogue = source.catalogueBinding;
  const candidateCatalogue = candidate.catalogueBinding;
  if (!isRecord(sourceCatalogue) || !isRecord(candidateCatalogue)) {
    return fail("catalogue_binding_missing");
  }
  for (const key of CATALOGUE_FIELDS) {
    if (!sameJson(candidateCatalogue[key], sourceCatalogue[key])) {
      return fail(`catalogue_${key}_mismatch`);
    }
  }
  if (!SHA256_RE.test(candidateCatalogue.sha256)) return fail("catalogue_digest_malformed");

  const sourceIndex = source.catalogueIndexBinding;
  const candidateIndex = candidate.catalogueIndexBinding;
  if (!isRecord(sourceIndex) || !isRecord(candidateIndex)) {
    return fail("catalogue_index_binding_missing");
  }
  if (candidate.status !== "qualified") return fail("candidate_not_qualified");
  for (const key of [
    "repository",
    "path",
    "catalogueGitSha",
    "sourceTreeSha256",
    "sha256",
    "requiredSkillIds",
  ]) {
    if (!sameJson(candidateIndex[key], sourceIndex[key])) {
      return fail(`catalogue_index_${key}_mismatch`);
    }
  }
  if (!GIT_SHA_RE.test(candidateIndex.catalogueGitSha)) return fail("catalogue_git_sha_malformed");
  if (!RAW_SHA256_RE.test(candidateIndex.sourceTreeSha256)) {
    return fail("catalogue_source_tree_digest_malformed");
  }
  if (!SHA256_RE.test(candidateIndex.sha256)) return fail("catalogue_index_digest_malformed");
  if (
    !Array.isArray(candidateIndex.requiredSkillIds) ||
    candidateIndex.requiredSkillIds.length === 0 ||
    new Set(candidateIndex.requiredSkillIds).size !== candidateIndex.requiredSkillIds.length
  ) {
    return fail("required_skill_ids_malformed");
  }
  if (
    !Array.isArray(candidateIndex.presentSkillIds) ||
    candidateIndex.presentSkillIds.length !== candidateIndex.requiredSkillIds.length ||
    new Set(candidateIndex.presentSkillIds).size !== candidateIndex.presentSkillIds.length ||
    !candidateIndex.requiredSkillIds.every((id) => candidateIndex.presentSkillIds.includes(id))
  ) {
    return fail("required_skill_ids_not_present");
  }

  if (candidateCatalogue.status !== "source-catalogue-bound") {
    return fail("catalogue_not_source_bound");
  }
  if (candidateCatalogue.providerRuntime !== "not executed by OpenClaw") {
    return fail("catalogue_runtime_claimed");
  }
  if (candidateIndex.status !== "qualified") return fail("catalogue_index_not_qualified");

  const sourceQualification = source.qualification;
  const qualification = candidate.qualification;
  if (!isRecord(sourceQualification) || !isRecord(qualification))
    return fail("qualification_missing");
  if (qualification.reason !== sourceQualification.reason) {
    return fail("qualification_reason_mismatch");
  }
  if (
    qualification.state !== "qualified" ||
    qualification.executionGate !== "enabled" ||
    qualification.exactReleaseRequired !== true ||
    qualification.catalogueDigestRequired !== true
  ) {
    return fail("qualification_gate_not_enabled");
  }

  if (!isRecord(source.retrieval) || !isRecord(candidate.retrieval))
    return fail("retrieval_missing");
  for (const key of RETRIEVAL_FIELDS) {
    if (candidate.retrieval[key] !== source.retrieval[key])
      return fail(`retrieval_${key}_mismatch`);
  }
  if (candidate.retrieval.copiedSkillBodies !== false) return fail("skill_bodies_copied");
  if (candidate.retrieval.providerRuntime !== "not executed by OpenClaw") {
    return fail("retrieval_runtime_claimed");
  }

  if (!Array.isArray(source.skills) || !Array.isArray(candidate.skills))
    return fail("skills_missing");
  if (candidate.skills.length !== source.skills.length || candidate.skills.length === 0) {
    return fail("skill_digest_set_size_mismatch");
  }
  for (let index = 0; index < source.skills.length; index += 1) {
    const expected = source.skills[index];
    const actual = candidate.skills[index];
    if (!isRecord(expected) || !isRecord(actual) || !sameJson(actual, expected)) {
      return fail(`skill_digest_mismatch_${index}`);
    }
    if (typeof actual.id !== "string" || !RAW_SHA256_RE.test(actual.sha256)) {
      return fail(`skill_digest_malformed_${index}`);
    }
  }

  if (!sameJson(candidate.unsupportedByDesign, source.unsupportedByDesign)) {
    return fail("unsupported_by_design_mismatch");
  }

  if (!isRecord(source.privacy)) return fail("privacy_missing");
  if (!isRecord(candidate.privacy) || candidate.privacy.liveGoogleCallsPerformed !== false) {
    return fail("live_google_calls_claimed");
  }
  for (const key of PRIVACY_FIELDS) {
    if (candidate.privacy[key] !== source.privacy[key]) return fail(`privacy_${key}_mismatch`);
  }
  return { ok: true };
}

/**
 * Consume the committed source receipt as an inert catalog. This never loads
 * skill bodies, never contacts LiNKskills, and never enables wrapper execution.
 */
export function consumeInertQualifiedSkills(source) {
  if (!isRecord(source)) return fail("receipt_not_object");
  if (source.schema !== SCHEMA) return fail("schema_mismatch");
  const sourceShape = validateReceiptShape(source, "source");
  if (sourceShape) return sourceShape;
  if (source.status !== "qualification-required") return fail("source_status_mismatch");
  if (
    source.qualification.state !== "unavailable" ||
    source.qualification.executionGate !== "fail-closed; no provider skill activation"
  ) {
    return fail("source_qualification_not_inert");
  }
  if (source.retrieval.copiedSkillBodies !== false) return fail("skill_bodies_copied");
  if (source.retrieval.providerRuntime !== "not executed by OpenClaw") {
    return fail("retrieval_runtime_claimed");
  }
  if (source.privacy.liveGoogleCallsPerformed !== false) return fail("live_google_calls_claimed");
  return {
    ok: true,
    mode: "inert-source-catalog",
    skillIds: source.skills.map((skill) => skill.id),
    executionEnabled: false,
    copiedSkillBodies: false,
    providerRuntime: source.retrieval.providerRuntime,
  };
}

export function validateQualifiedSkillsReceiptFiles(sourcePath, candidatePath) {
  try {
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
    return validateQualifiedSkillsReceipt(source, candidate);
  } catch {
    return fail("receipt_unreadable_or_invalid_json");
  }
}

function isDirectExecution() {
  return (
    process.argv[1] &&
    path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])
  );
}

if (isDirectExecution()) {
  const [sourcePath, candidatePath] = process.argv.slice(2);
  if (!sourcePath || !candidatePath) {
    process.stderr.write("usage: qualification-receipt.mjs <source-receipt> <candidate-receipt>\n");
    process.exit(2);
  }
  const result = validateQualifiedSkillsReceiptFiles(sourcePath, candidatePath);
  if (!result.ok) {
    process.stderr.write(`qualification receipt rejected: ${result.reason}\n`);
    process.exit(1);
  }
  process.stdout.write("PASS qualified Skills receipt matches source contract\n");
}

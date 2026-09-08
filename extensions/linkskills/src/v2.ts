import { createHash } from "node:crypto";
import {
  SKILLS_COMMIT,
  SKILLS_CONTRACT_VERSION,
  SKILLS_MCP_PROTOCOL_VERSION,
  SKILLS_TREE,
} from "./exact-release.js";

export const SKILLS_V2_RESOURCE_OPERATIONS = Object.freeze([
  "skills_capabilities_get",
  "skills_catalog_list",
  "skills_catalog_search",
  "skills_release_list",
  "skills_release_describe",
  "skills_qualification_get",
  "skills_release_entrypoint_get",
  "skills_release_sections_list",
  "skills_release_section_get",
  "skills_release_resources_list",
  "skills_release_resource_get",
  "skills_release_content_get",
  "skills_release_package_get",
] as const);
export const SKILLS_V2_TOOL_OPERATIONS = Object.freeze([
  "skills_release_verify",
  "skills_use_report_submit",
  "skills_use_report_status_get",
  "skills_feedback_submit",
  "skills_feedback_status_get",
  "skills_librarian_status_get",
] as const);
export const SKILLS_V2_OPERATIONS = Object.freeze([
  ...SKILLS_V2_RESOURCE_OPERATIONS,
  ...SKILLS_V2_TOOL_OPERATIONS,
] as const);
export type SkillsV2Operation = (typeof SKILLS_V2_OPERATIONS)[number];
export const SKILLS_V2_AUDIENCE = "lskills-api" as const;
export const SKILLS_V2_REQUIRED_SCOPE = "lskills" as const;
export const SKILLS_V2_REQUIRED_CAPABILITY = "skills.read" as const;
export const SKILLS_V2_READ_PERMISSION = "skills:read" as const;
export const SKILLS_V2_WRITE_PERMISSION = "skills:write" as const;

export type SkillsV2TrustedAuthorization = Readonly<{
  organizationId: string;
  actorId: string;
  credentialId: string;
  audience: typeof SKILLS_V2_AUDIENCE;
  serviceScopes: readonly string[];
  capabilities: readonly string[];
  permittedOperations: readonly string[];
  runtimeBindingRef: string;
  issuedAt: string;
  expiresAt: string;
  revocationStatus: "active";
  revocationObservedAt: string;
  revocationCredentialId: string;
}>;

const COMMON_REQUEST_FIELDS = [
  "providerCandidate",
  "protocolVersion",
  "contractVersion",
  "operation",
  "actorId",
  "idempotencyKey",
] as const;
const OPERATION_REQUEST_FIELDS: Readonly<Record<SkillsV2Operation, readonly string[]>> = {
  skills_capabilities_get: [],
  skills_catalog_list: ["cursor", "limit"],
  skills_catalog_search: ["query", "cursor", "limit"],
  skills_release_list: ["skillId", "cursor", "limit"],
  skills_release_describe: ["skillId", "version", "cursor", "limit"],
  skills_qualification_get: ["skillId", "version", "cursor", "limit"],
  skills_release_entrypoint_get: ["skillId", "version", "cursor", "limit"],
  skills_release_sections_list: ["skillId", "version", "cursor", "limit"],
  skills_release_section_get: ["skillId", "version", "sectionId", "cursor", "limit"],
  skills_release_resources_list: ["skillId", "version", "cursor", "limit"],
  skills_release_resource_get: ["skillId", "version", "resourceId", "cursor", "limit"],
  skills_release_content_get: ["skillId", "version", "contentId", "cursor", "limit"],
  skills_release_package_get: ["skillId", "version", "cursor", "limit"],
  skills_release_verify: ["skillId", "version"],
  skills_use_report_submit: ["reportRef"],
  skills_use_report_status_get: ["reportRef"],
  skills_feedback_submit: ["skillId", "version", "feedbackRef"],
  skills_feedback_status_get: ["feedbackRef"],
  skills_librarian_status_get: [],
};
const SKILLS_V2_WRITE_OPERATIONS = new Set<SkillsV2Operation>([
  "skills_use_report_submit",
  "skills_feedback_submit",
]);

export type SkillsV2Request = Readonly<{
  providerCandidate: { commit: typeof SKILLS_COMMIT; tree: typeof SKILLS_TREE };
  protocolVersion: typeof SKILLS_MCP_PROTOCOL_VERSION;
  contractVersion: typeof SKILLS_CONTRACT_VERSION;
  operation: SkillsV2Operation;
  actorId: string;
  idempotencyKey: string;
  skillId?: string;
  version?: string;
  query?: string;
  sectionId?: string;
  resourceId?: string;
  contentId?: string;
  feedbackRef?: string;
  reportRef?: string;
  cursor?: string;
  limit?: number;
}>;

const legacy = /^(skills_run_|skills_tool_)/;
const MOVING_VERSION_ALIAS = /^(latest|current|stable|newest)$/iu;
const SNAPSHOT_CURSOR = /^snapshot:[0-9a-f]{16}:(?:0|[1-9][0-9]*)$/u;
const AUTH_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/u;
const AUTHORIZATION_MAX_AGE_MS = 5 * 60 * 1000;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const snapshotOwnDataRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return undefined;
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      return undefined;
    }
    const snapshot = Object.create(null) as Record<string, unknown>;
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (!("value" in descriptor)) {
        return undefined;
      }
      snapshot[key] = descriptor.value;
    }
    return snapshot;
  } catch {
    return undefined;
  }
};
const hasControlCharacters = (value: string): boolean => {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
};
const bounded = (value: unknown, max = 256): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= max &&
  !hasControlCharacters(value);
const snapshotDenseStrings = (value: unknown): readonly string[] | undefined => {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return undefined;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<
      string,
      PropertyDescriptor
    >;
    const length = descriptors.length?.value;
    if (!Number.isSafeInteger(length) || length < 0) {
      return undefined;
    }
    const result: string[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !("value" in descriptor) || !bounded(descriptor.value)) {
        return undefined;
      }
      result.push(descriptor.value);
    }
    if (Object.keys(descriptors).some((key) => key !== "length" && !/^\d+$/u.test(key))) {
      return undefined;
    }
    return Object.freeze(result);
  } catch {
    return undefined;
  }
};
const authorizationTime = (value: unknown): number | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const match = AUTH_TIMESTAMP.exec(value);
  if (!match) {
    return undefined;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  const date = new Date(parsed);
  return date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3]) &&
    date.getUTCHours() === Number(match[4]) &&
    date.getUTCMinutes() === Number(match[5]) &&
    date.getUTCSeconds() === Number(match[6]) &&
    date.getUTCMilliseconds() === Number(match[7])
    ? parsed
    : undefined;
};

export function skillsSnapshotCursor(catalogVersion: string): string {
  if (!bounded(catalogVersion, 512)) {
    throw new Error("invalid Skills catalog version");
  }
  return `snapshot:${createHash("sha256").update(catalogVersion).digest("hex").slice(0, 16)}:0`;
}

export function isModernSkillsOperation(value: unknown): value is SkillsV2Operation {
  return (
    typeof value === "string" &&
    !legacy.test(value) &&
    (SKILLS_V2_OPERATIONS as readonly string[]).includes(value)
  );
}

/** Authorization comes from Platform-authenticated transport facts, never request data. */
export function validateSkillsV2Request(
  input: unknown,
  trustedAuthorization: unknown,
  now = new Date(),
):
  | { ok: true; request: SkillsV2Request }
  | {
      ok: false;
      code:
        | "invalid_shape"
        | "wrong_provider"
        | "incompatible_protocol"
        | "legacy_execution_disabled"
        | "invalid_pagination"
        | "invalid_authorization";
    } {
  const authorization = snapshotOwnDataRecord(trustedAuthorization);
  const serviceScopes = snapshotDenseStrings(authorization?.serviceScopes);
  const capabilities = snapshotDenseStrings(authorization?.capabilities);
  const permittedOperations = snapshotDenseStrings(authorization?.permittedOperations);
  let nowMilliseconds = Number.NaN;
  try {
    nowMilliseconds = Date.prototype.getTime.call(now);
  } catch {
    // Invalid caller clocks fail through the authorization checks below.
  }
  const issuedAt = authorizationTime(authorization?.issuedAt);
  const expiresAt = authorizationTime(authorization?.expiresAt);
  const revocationObservedAt = authorizationTime(authorization?.revocationObservedAt);
  if (
    !authorization ||
    Object.keys(authorization).toSorted().join(",") !==
      "actorId,audience,capabilities,credentialId,expiresAt,issuedAt,organizationId,permittedOperations,revocationCredentialId,revocationObservedAt,revocationStatus,runtimeBindingRef,serviceScopes" ||
    !bounded(authorization.organizationId) ||
    !bounded(authorization.actorId) ||
    !bounded(authorization.credentialId) ||
    authorization.audience !== SKILLS_V2_AUDIENCE ||
    !serviceScopes?.includes(SKILLS_V2_REQUIRED_SCOPE) ||
    !capabilities?.includes(SKILLS_V2_REQUIRED_CAPABILITY) ||
    !permittedOperations ||
    !bounded(authorization.runtimeBindingRef) ||
    authorization.revocationStatus !== "active" ||
    authorization.revocationCredentialId !== authorization.credentialId ||
    !Number.isFinite(nowMilliseconds) ||
    issuedAt === undefined ||
    expiresAt === undefined ||
    revocationObservedAt === undefined ||
    issuedAt > nowMilliseconds ||
    expiresAt <= nowMilliseconds ||
    revocationObservedAt < issuedAt ||
    revocationObservedAt > nowMilliseconds ||
    nowMilliseconds - revocationObservedAt > AUTHORIZATION_MAX_AGE_MS
  ) {
    return { ok: false, code: "invalid_authorization" };
  }
  const value = snapshotOwnDataRecord(input);
  if (!value) {
    return { ok: false, code: "invalid_shape" };
  }
  const candidate = snapshotOwnDataRecord(value.providerCandidate);
  if (
    !candidate ||
    Object.keys(candidate).length !== 2 ||
    candidate.commit !== SKILLS_COMMIT ||
    candidate.tree !== SKILLS_TREE
  ) {
    return { ok: false, code: "wrong_provider" };
  }
  if (
    value.protocolVersion !== SKILLS_MCP_PROTOCOL_VERSION ||
    value.contractVersion !== SKILLS_CONTRACT_VERSION
  ) {
    return { ok: false, code: "incompatible_protocol" };
  }
  if (typeof value.operation === "string" && legacy.test(value.operation)) {
    return { ok: false, code: "legacy_execution_disabled" };
  }
  if (
    !isModernSkillsOperation(value.operation) ||
    !bounded(value.actorId) ||
    value.actorId !== authorization.actorId ||
    !bounded(value.idempotencyKey, 160)
  ) {
    return { ok: false, code: "invalid_shape" };
  }
  const requiredPermission = SKILLS_V2_WRITE_OPERATIONS.has(value.operation)
    ? SKILLS_V2_WRITE_PERMISSION
    : SKILLS_V2_READ_PERMISSION;
  if (!permittedOperations.includes(requiredPermission)) {
    return { ok: false, code: "invalid_authorization" };
  }
  const allowed = new Set([...COMMON_REQUEST_FIELDS, ...OPERATION_REQUEST_FIELDS[value.operation]]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    return { ok: false, code: "invalid_shape" };
  }
  const limit = value.limit;
  if (
    limit !== undefined &&
    (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 100)
  ) {
    return { ok: false, code: "invalid_pagination" };
  }
  if (
    value.cursor !== undefined &&
    (!bounded(value.cursor, 256) || !SNAPSHOT_CURSOR.test(value.cursor))
  ) {
    return { ok: false, code: "invalid_pagination" };
  }
  if (value.skillId !== undefined && !bounded(value.skillId)) {
    return { ok: false, code: "invalid_shape" };
  }
  if (value.version !== undefined && !bounded(value.version, 128)) {
    return { ok: false, code: "invalid_shape" };
  }
  if (typeof value.version === "string" && MOVING_VERSION_ALIAS.test(value.version)) {
    return { ok: false, code: "invalid_shape" };
  }
  if (value.query !== undefined && !bounded(value.query, 512)) {
    return { ok: false, code: "invalid_shape" };
  }
  for (const field of [
    "sectionId",
    "resourceId",
    "contentId",
    "feedbackRef",
    "reportRef",
  ] as const) {
    if (value[field] !== undefined && !bounded(value[field])) {
      return { ok: false, code: "invalid_shape" };
    }
  }
  if (
    (value.operation === "skills_release_describe" ||
      value.operation === "skills_release_verify") &&
    (!bounded(value.skillId) || !bounded(value.version))
  ) {
    return { ok: false, code: "invalid_shape" };
  }
  const requiresReleaseIdentity = new Set([
    "skills_release_sections_list",
    "skills_release_section_get",
    "skills_release_resources_list",
    "skills_release_resource_get",
    "skills_release_content_get",
    "skills_release_package_get",
    "skills_release_entrypoint_get",
    "skills_qualification_get",
  ]);
  if (value.operation === "skills_release_list" && !bounded(value.skillId)) {
    return { ok: false, code: "invalid_shape" };
  }
  if (value.operation === "skills_catalog_search" && !bounded(value.query, 512)) {
    return { ok: false, code: "invalid_shape" };
  }
  if (
    requiresReleaseIdentity.has(value.operation) &&
    (!bounded(value.skillId) || !bounded(value.version))
  ) {
    return { ok: false, code: "invalid_shape" };
  }
  if (value.operation === "skills_release_section_get" && !bounded(value.sectionId)) {
    return { ok: false, code: "invalid_shape" };
  }
  if (value.operation === "skills_release_resource_get" && !bounded(value.resourceId)) {
    return { ok: false, code: "invalid_shape" };
  }
  if (value.operation === "skills_release_content_get" && !bounded(value.contentId)) {
    return { ok: false, code: "invalid_shape" };
  }
  if (
    (value.operation === "skills_feedback_submit" ||
      value.operation === "skills_feedback_status_get") &&
    !bounded(value.feedbackRef)
  ) {
    return { ok: false, code: "invalid_shape" };
  }
  if (
    value.operation === "skills_feedback_submit" &&
    (!bounded(value.skillId) || !bounded(value.version))
  ) {
    return { ok: false, code: "invalid_shape" };
  }
  if (
    (value.operation === "skills_use_report_submit" ||
      value.operation === "skills_use_report_status_get") &&
    !bounded(value.reportRef)
  ) {
    return { ok: false, code: "invalid_shape" };
  }
  return {
    ok: true,
    request: Object.freeze({
      providerCandidate: Object.freeze({ commit: SKILLS_COMMIT, tree: SKILLS_TREE }),
      protocolVersion: SKILLS_MCP_PROTOCOL_VERSION,
      contractVersion: SKILLS_CONTRACT_VERSION,
      operation: value.operation,
      actorId: value.actorId,
      idempotencyKey: value.idempotencyKey,
      ...(value.skillId === undefined ? {} : { skillId: value.skillId }),
      ...(value.version === undefined ? {} : { version: value.version }),
      ...(value.query === undefined ? {} : { query: value.query }),
      ...(value.sectionId === undefined ? {} : { sectionId: value.sectionId }),
      ...(value.resourceId === undefined ? {} : { resourceId: value.resourceId }),
      ...(value.contentId === undefined ? {} : { contentId: value.contentId }),
      ...(value.feedbackRef === undefined ? {} : { feedbackRef: value.feedbackRef }),
      ...(value.reportRef === undefined ? {} : { reportRef: value.reportRef }),
      ...(value.cursor === undefined ? {} : { cursor: value.cursor }),
      ...(value.limit === undefined ? {} : { limit: value.limit }),
    }) as SkillsV2Request,
  };
}

/** Accepts qualification evidence only when it names the requested exact release. */
export function validateSkillsQualificationIdentity(value: unknown, expected: unknown): boolean {
  const evidence = snapshotOwnDataRecord(value);
  const expectation = snapshotOwnDataRecord(expected);
  return (
    evidence !== undefined &&
    expectation !== undefined &&
    bounded(evidence.skillId) &&
    bounded(evidence.version, 128) &&
    bounded(expectation.skillId) &&
    bounded(expectation.version, 128) &&
    !MOVING_VERSION_ALIAS.test(evidence.version) &&
    !MOVING_VERSION_ALIAS.test(expectation.version) &&
    evidence.skillId === expectation.skillId &&
    evidence.version === expectation.version
  );
}

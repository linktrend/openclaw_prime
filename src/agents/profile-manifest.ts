import { isRecord } from "@openclaw/normalization-core/record-coerce";
import { err, ok, type Result } from "@openclaw/normalization-core/result";
import { normalizeOptionalString } from "@openclaw/normalization-core/string-coerce";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { listAgentEntries } from "./agent-scope-config.js";

export const PROFILE_MANIFEST_SCHEMA_VERSION = 1;
export const OPENCLAW_PROFILE_RUNTIME_PIN = "openclaw-profile-runtime:v1";

/** Shipped OpenClaw config has no live-activation key; active profiles stay unauthorized. */
export const PROFILE_MANIFEST_LIVE_ACTIVATION_CONFIG_PATH =
  "agents.defaults.experimental.profileManifestLiveActivation";

export const PROFILE_EXCLUSION_KEYS = [
  "credentials",
  "accountIds",
  "privateState",
  "sessions",
  "recipients",
  "schedules",
  "jobs",
  "cookies",
  "downloads",
  "workspace",
] as const;

export type ProfileExclusionKey = (typeof PROFILE_EXCLUSION_KEYS)[number];

export type ProfileExclusions = { [K in ProfileExclusionKey]: true };

export type ProfileActivation = "inactive" | "active";

export type CommonProfileManifest = {
  schemaVersion: typeof PROFILE_MANIFEST_SCHEMA_VERSION;
  profileId: string;
  roleRefs: string[];
  identityRef: string;
  activation: ProfileActivation;
  capabilityClasses: string[];
  providerPins: Record<string, string>;
  skillPins: Record<string, string>;
  modelPolicyRef: string;
  toolExposure: string[];
  stateOwners: Record<string, string>;
  channelRefs?: string[];
  accountRefs?: string[];
  exclusions: ProfileExclusions;
};

export type ProfileManifestIssue = {
  code:
    | "invalid-shape"
    | "unsupported-schema"
    | "invalid-profile-id"
    | "invalid-opaque-ref"
    | "missing-runtime-pin"
    | "incomplete-exclusions"
    | "live-fields-present"
    | "activation-not-authorized"
    | "incomplete-generic-structure";
  message: string;
  path?: string;
};

export type ProfileProvisioningDryRun = {
  mode: "dry-run";
  activation: "inactive";
  profileId: string;
  runtimeActor: false;
  credential: false;
  grant: false;
  session: false;
  channel: false;
  job: false;
  recipient: false;
  privateState: false;
  effects: [];
};

export type ProfileRuntimeAdmission =
  | { admitted: true; kind: "legacy" }
  | { admitted: true; kind: "active-profile"; activation: "active" }
  | {
      admitted: false;
      reason: "inactive-profile" | "invalid-manifest";
      message: string;
    };

const OPAQUE_REF_RE = /^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9._:-]*$/;
const PROFILE_ID_RE = /^[a-z][a-z0-9-]{0,63}$/;

const LIVE_FIELD_KEYS = [
  "account",
  "accountId",
  "accountIds",
  "accounts",
  "actorId",
  "apiKey",
  "cookie",
  "cookies",
  "credential",
  "credentials",
  "grant",
  "grants",
  "password",
  "privateMemory",
  "privateState",
  "recipient",
  "recipients",
  "secret",
  "secrets",
  "session",
  "sessions",
  "token",
  "tokens",
  "workspaceState",
] as const;

const LIVE_FIELD_KEY_SET = new Set<string>(LIVE_FIELD_KEYS);

const REQUIRED_EXCLUSIONS: ProfileExclusions = {
  credentials: true,
  accountIds: true,
  privateState: true,
  sessions: true,
  recipients: true,
  schedules: true,
  jobs: true,
  cookies: true,
  downloads: true,
  workspace: true,
};

function issue(
  code: ProfileManifestIssue["code"],
  message: string,
  path?: string,
): ProfileManifestIssue {
  return path ? { code, message, path } : { code, message };
}

function isOpaqueRef(value: string): boolean {
  if (!OPAQUE_REF_RE.test(value)) {
    return false;
  }
  return !value.includes("@") && !value.includes("://");
}

function readStringList(value: unknown, path: string): Result<string[], ProfileManifestIssue> {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    return err(issue("invalid-shape", `${path} must be a string array`, path));
  }
  const unique = [...new Set(value.map((entry) => entry.trim()).filter(Boolean))];
  unique.sort();
  return ok(unique);
}

function isOwnerToken(value: string): boolean {
  return isOpaqueRef(value) || PROFILE_ID_RE.test(value);
}

function readOwnerRef(value: unknown, path: string): Result<string, ProfileManifestIssue> {
  const text = normalizeOptionalString(value);
  if (!text || !isOwnerToken(text)) {
    return err(
      issue("invalid-opaque-ref", `${path} must be an opaque reference or store identifier`, path),
    );
  }
  return ok(text);
}

function readOwnerRefMap(
  value: unknown,
  path: string,
): Result<Record<string, string>, ProfileManifestIssue> {
  if (!isRecord(value)) {
    return err(issue("invalid-shape", `${path} must be an object of owner tokens`, path));
  }
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return err(issue("invalid-shape", `${path} must declare at least one owner`, path));
  }
  const next: Record<string, string> = {};
  for (const [key, raw] of entries) {
    if (!PROFILE_ID_RE.test(key)) {
      return err(
        issue("invalid-shape", `${path} keys must be lowercase identifiers`, `${path}.${key}`),
      );
    }
    const parsed = readOwnerRef(raw, `${path}.${key}`);
    if (!parsed.ok) {
      return parsed;
    }
    next[key] = parsed.value;
  }
  return ok(
    Object.fromEntries(
      [...Object.entries(next)].sort(([left], [right]) => left.localeCompare(right)),
    ),
  );
}

function readOpaqueRef(value: unknown, path: string): Result<string, ProfileManifestIssue> {
  const text = normalizeOptionalString(value);
  if (!text || !isOpaqueRef(text)) {
    return err(issue("invalid-opaque-ref", `${path} must be an opaque namespaced reference`, path));
  }
  return ok(text);
}

function readOpaqueRefMap(
  value: unknown,
  path: string,
): Result<Record<string, string>, ProfileManifestIssue> {
  if (!isRecord(value)) {
    return err(issue("invalid-shape", `${path} must be an object of opaque refs`, path));
  }
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return err(issue("invalid-shape", `${path} must declare at least one pin`, path));
  }
  const next: Record<string, string> = {};
  for (const [key, raw] of entries) {
    if (!PROFILE_ID_RE.test(key)) {
      return err(
        issue("invalid-shape", `${path} keys must be lowercase identifiers`, `${path}.${key}`),
      );
    }
    const parsed = readOpaqueRef(raw, `${path}.${key}`);
    if (!parsed.ok) {
      return parsed;
    }
    next[key] = parsed.value;
  }
  return ok(
    Object.fromEntries(
      [...Object.entries(next)].sort(([left], [right]) => left.localeCompare(right)),
    ),
  );
}

function readOpaqueRefList(
  value: unknown,
  path: string,
): Result<string[] | undefined, ProfileManifestIssue> {
  if (value === undefined) {
    return ok(undefined);
  }
  const list = readStringList(value, path);
  if (!list.ok) {
    return list;
  }
  for (const entry of list.value) {
    if (!isOpaqueRef(entry)) {
      return err(issue("invalid-opaque-ref", `${path} must contain only opaque refs`, path));
    }
  }
  return ok(list.value);
}

export function findLiveProfileFields(value: unknown, path = "$"): string[] {
  const found: string[] = [];
  const visit = (node: unknown, nodePath: string): void => {
    if (Array.isArray(node)) {
      node.forEach((entry, index) => visit(entry, `${nodePath}[${index}]`));
      return;
    }
    if (!isRecord(node)) {
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      const childPath = `${nodePath}.${key}`;
      if (key === "exclusions" && isRecord(child)) {
        continue;
      }
      if (LIVE_FIELD_KEY_SET.has(key)) {
        found.push(childPath);
      }
      visit(child, childPath);
    }
  };
  visit(value, path);
  found.sort();
  return found;
}

function readExclusions(value: unknown): Result<ProfileExclusions, ProfileManifestIssue> {
  if (!isRecord(value)) {
    return err(issue("incomplete-exclusions", "exclusions must be an object", "exclusions"));
  }
  for (const key of PROFILE_EXCLUSION_KEYS) {
    if (value[key] !== true) {
      return err(
        issue(
          "incomplete-exclusions",
          `inactive profiles must exclude ${key}`,
          `exclusions.${key}`,
        ),
      );
    }
  }
  for (const [key, flag] of Object.entries(value)) {
    if (flag !== true) {
      return err(
        issue("incomplete-exclusions", "exclusion flags must be true", `exclusions.${key}`),
      );
    }
  }
  return ok({ ...REQUIRED_EXCLUSIONS });
}

function readActivation(value: unknown): Result<ProfileActivation, ProfileManifestIssue> {
  if (value === "inactive" || value === "active") {
    return ok(value);
  }
  if (isRecord(value) && value.profile === "inactive") {
    return ok("inactive");
  }
  if (isRecord(value) && value.profile === "active") {
    return ok("active");
  }
  return err(issue("invalid-shape", "activation must be inactive or active", "activation"));
}

export function parseCommonProfileManifest(
  value: unknown,
): Result<CommonProfileManifest, ProfileManifestIssue> {
  if (!isRecord(value)) {
    return err(issue("invalid-shape", "profile manifest must be an object"));
  }
  const liveFields = findLiveProfileFields(value);
  if (liveFields.length > 0) {
    return err(
      issue(
        "live-fields-present",
        `source contains live secret, account, or private-state fields: ${liveFields.join(", ")}`,
      ),
    );
  }
  if (value.schemaVersion !== PROFILE_MANIFEST_SCHEMA_VERSION) {
    return err(issue("unsupported-schema", "schemaVersion must be 1", "schemaVersion"));
  }
  const profileId = normalizeOptionalString(value.profileId);
  if (!profileId || !PROFILE_ID_RE.test(profileId)) {
    return err(
      issue("invalid-profile-id", "profileId must be a lowercase identifier", "profileId"),
    );
  }
  const roleRefs = readStringList(value.roleRefs, "roleRefs");
  if (!roleRefs.ok) {
    return roleRefs;
  }
  for (const ref of roleRefs.value) {
    if (!isOpaqueRef(ref)) {
      return err(issue("invalid-opaque-ref", "roleRefs must be opaque references", "roleRefs"));
    }
  }
  const identityRef = readOpaqueRef(value.identityRef, "identityRef");
  if (!identityRef.ok) {
    return identityRef;
  }
  const activation = readActivation(value.activation);
  if (!activation.ok) {
    return activation;
  }
  const capabilityClasses = readStringList(value.capabilityClasses, "capabilityClasses");
  if (!capabilityClasses.ok) {
    return capabilityClasses;
  }
  const providerPins = readOpaqueRefMap(value.providerPins, "providerPins");
  if (!providerPins.ok) {
    return providerPins;
  }
  if (providerPins.value.openclaw !== OPENCLAW_PROFILE_RUNTIME_PIN) {
    return err(
      issue(
        "missing-runtime-pin",
        `providerPins.openclaw must be ${OPENCLAW_PROFILE_RUNTIME_PIN}`,
        "providerPins.openclaw",
      ),
    );
  }
  const skillPins = readOpaqueRefMap(value.skillPins, "skillPins");
  if (!skillPins.ok) {
    return skillPins;
  }
  const modelPolicyRef = readOpaqueRef(value.modelPolicyRef, "modelPolicyRef");
  if (!modelPolicyRef.ok) {
    return modelPolicyRef;
  }
  const toolExposure = readStringList(value.toolExposure, "toolExposure");
  if (!toolExposure.ok) {
    return toolExposure;
  }
  const stateOwners = readOwnerRefMap(value.stateOwners, "stateOwners");
  if (!stateOwners.ok) {
    return stateOwners;
  }
  const channelRefs = readOpaqueRefList(value.channelRefs, "channelRefs");
  if (!channelRefs.ok) {
    return channelRefs;
  }
  const accountRefs = readOpaqueRefList(value.accountRefs, "accountRefs");
  if (!accountRefs.ok) {
    return accountRefs;
  }
  const exclusions = readExclusions(value.exclusions);
  if (!exclusions.ok) {
    return exclusions;
  }
  return ok(
    exportCommonProfileManifest({
      schemaVersion: PROFILE_MANIFEST_SCHEMA_VERSION,
      profileId,
      roleRefs: roleRefs.value,
      identityRef: identityRef.value,
      activation: activation.value,
      capabilityClasses: capabilityClasses.value,
      providerPins: providerPins.value,
      skillPins: skillPins.value,
      modelPolicyRef: modelPolicyRef.value,
      toolExposure: toolExposure.value,
      stateOwners: stateOwners.value,
      ...(channelRefs.value ? { channelRefs: channelRefs.value } : {}),
      ...(accountRefs.value ? { accountRefs: accountRefs.value } : {}),
      exclusions: exclusions.value,
    }),
  );
}

export function exportCommonProfileManifest(
  manifest: CommonProfileManifest,
): CommonProfileManifest {
  return {
    schemaVersion: PROFILE_MANIFEST_SCHEMA_VERSION,
    profileId: manifest.profileId,
    roleRefs: [...manifest.roleRefs],
    identityRef: manifest.identityRef,
    activation: manifest.activation,
    capabilityClasses: [...manifest.capabilityClasses],
    providerPins: { ...manifest.providerPins },
    skillPins: { ...manifest.skillPins },
    modelPolicyRef: manifest.modelPolicyRef,
    toolExposure: [...manifest.toolExposure],
    stateOwners: { ...manifest.stateOwners },
    ...(manifest.channelRefs ? { channelRefs: [...manifest.channelRefs] } : {}),
    ...(manifest.accountRefs ? { accountRefs: [...manifest.accountRefs] } : {}),
    exclusions: { ...REQUIRED_EXCLUSIONS },
  };
}

export function isLiveProfileActivationAuthorized(_cfg?: OpenClawConfig): boolean {
  // No shipped config key admits live activation; extra experimental flags are not a contract.
  return false;
}

export function authorizeProfileManifest(
  manifest: CommonProfileManifest,
  cfg?: OpenClawConfig,
): Result<CommonProfileManifest, ProfileManifestIssue> {
  if (manifest.activation === "inactive") {
    return ok(manifest);
  }
  if (!isLiveProfileActivationAuthorized(cfg)) {
    return err(
      issue(
        "activation-not-authorized",
        `live profile activation is fail-closed until ${PROFILE_MANIFEST_LIVE_ACTIVATION_CONFIG_PATH} is a shipped contract`,
        "activation",
      ),
    );
  }
  return ok(manifest);
}

export function dryRunInactiveProfileProvisioning(
  manifest: CommonProfileManifest,
): Result<ProfileProvisioningDryRun, ProfileManifestIssue> {
  const authorized = authorizeProfileManifest(manifest);
  if (!authorized.ok) {
    return authorized;
  }
  if (authorized.value.activation !== "inactive") {
    return err(
      issue("activation-not-authorized", "dry-run provisioning requires inactive activation"),
    );
  }
  return ok({
    mode: "dry-run",
    activation: "inactive",
    profileId: manifest.profileId,
    runtimeActor: false,
    credential: false,
    grant: false,
    session: false,
    channel: false,
    job: false,
    recipient: false,
    privateState: false,
    effects: [],
  });
}

export function cloneCommonProfileManifest(
  source: unknown,
): Result<CommonProfileManifest, ProfileManifestIssue> {
  const liveFields = findLiveProfileFields(source);
  if (liveFields.length > 0) {
    return err(
      issue(
        "live-fields-present",
        `clone rejected live secret, account, or private-state fields: ${liveFields.join(", ")}`,
      ),
    );
  }
  if (!isRecord(source)) {
    return err(issue("invalid-shape", "clone source must be an object"));
  }
  const parsed = parseCommonProfileManifest({
    ...source,
    activation: "inactive",
    exclusions: REQUIRED_EXCLUSIONS,
  });
  if (parsed.ok) {
    return parsed;
  }
  return err(
    issue(
      "incomplete-generic-structure",
      "clone copies only generic inactive profile structure; source is missing required refs or pins",
    ),
  );
}

export function readOptionalProfileManifest(
  entry: unknown,
): Result<CommonProfileManifest, ProfileManifestIssue> | undefined {
  if (!isRecord(entry) || !Object.hasOwn(entry, "profileManifest")) {
    return undefined;
  }
  return parseCommonProfileManifest(entry.profileManifest);
}

export function resolveProfileRuntimeAdmission(
  cfg: OpenClawConfig,
  agentId: string,
): ProfileRuntimeAdmission {
  const id = normalizeAgentId(agentId);
  const entry = listAgentEntries(cfg).find((candidate) => normalizeAgentId(candidate.id) === id);
  const parsed = readOptionalProfileManifest(entry);
  if (!parsed) {
    return { admitted: true, kind: "legacy" };
  }
  if (!parsed.ok) {
    return { admitted: false, reason: "invalid-manifest", message: parsed.error.message };
  }
  if (parsed.value.activation !== "active" || !isLiveProfileActivationAuthorized(cfg)) {
    return {
      admitted: false,
      reason: "inactive-profile",
      message: `inactive profile "${id}" cannot route, schedule, or authenticate`,
    };
  }
  return { admitted: true, kind: "active-profile", activation: "active" };
}

export function profileCanRoute(cfg: OpenClawConfig, agentId: string): boolean {
  return resolveProfileRuntimeAdmission(cfg, agentId).admitted;
}

export function profileCanSchedule(cfg: OpenClawConfig, agentId: string): boolean {
  return profileCanRoute(cfg, agentId);
}

export function profileCanAuthenticate(cfg: OpenClawConfig, agentId: string): boolean {
  return profileCanRoute(cfg, agentId);
}

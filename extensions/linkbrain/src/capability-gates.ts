/**
 * Independent fail-closed Brain capability exposure.
 * Brain evidence never grants Platform eligibility, Skills qualification, or profile activation.
 */
import { BRAIN_V2_OPERATIONS, LINKBRAIN_V2_COMMIT, LINKBRAIN_V2_TREE } from "./v2-pins.js";

export const BRAIN_DECLARED_CAPABILITIES = BRAIN_V2_OPERATIONS;
export type BrainDeclaredCapability = (typeof BRAIN_DECLARED_CAPABILITIES)[number];

const REF = /^[A-Za-z0-9._:/@-]{1,256}$/;
const FORBIDDEN_ELEVATION_KEYS = Object.freeze([
  "roleGrant",
  "brainRule",
  "visibleSkill",
  "librariesPackage",
  "autoworkReceipt",
  "programAuthority",
  "executionAuthorityGrant",
] as const);

export type PreparedRuntimeFacts = Readonly<{
  actorId: string;
  audience: string;
  scope: string;
  resource: string;
  action: string;
  tenantId: string;
  agentId: string;
}>;

export type GateDecision = Readonly<{
  gate: "platform_eligibility" | "skills_qualification" | "profile_activation";
  outcome: "allow" | "deny" | "not_applicable";
  reason?: string;
}>;

export type CapabilityAuthorization =
  | Readonly<{
      ok: true;
      capability: BrainDeclaredCapability;
      facts: PreparedRuntimeFacts;
      gates: readonly GateDecision[];
    }>
  | Readonly<{ ok: false; reason: string; gates: readonly GateDecision[] }>;

const isRef = (value: unknown): value is string =>
  typeof value === "string" && REF.test(value) && value.length > 0;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function ownData(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  try {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
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
}

function elevationRejected(value: Record<string, unknown>): string | undefined {
  for (const key of FORBIDDEN_ELEVATION_KEYS) {
    if (key in value) {
      return "elevation_claim_rejected";
    }
  }
  return undefined;
}

export function prepareProviderRuntimeFacts(input: unknown): PreparedRuntimeFacts | undefined {
  const value = ownData(input);
  if (!value) {
    return undefined;
  }
  const fields = [
    "actorId",
    "audience",
    "scope",
    "resource",
    "action",
    "tenantId",
    "agentId",
  ] as const;
  for (const field of fields) {
    if (!isRef(value[field])) {
      return undefined;
    }
  }
  return Object.freeze({
    actorId: value.actorId as string,
    audience: value.audience as string,
    scope: value.scope as string,
    resource: value.resource as string,
    action: value.action as string,
    tenantId: value.tenantId as string,
    agentId: value.agentId as string,
  });
}

export function evaluatePlatformEligibilityGate(
  input: unknown,
  facts: PreparedRuntimeFacts,
): GateDecision {
  const value = ownData(input);
  if (!value || value.outcome !== "allow") {
    return { gate: "platform_eligibility", outcome: "deny", reason: "platform_eligibility_denied" };
  }
  const sealed = prepareProviderRuntimeFacts(value.facts);
  if (
    !sealed ||
    sealed.actorId !== facts.actorId ||
    sealed.audience !== facts.audience ||
    sealed.scope !== facts.scope ||
    sealed.resource !== facts.resource ||
    sealed.action !== facts.action ||
    sealed.tenantId !== facts.tenantId ||
    sealed.agentId !== facts.agentId
  ) {
    return { gate: "platform_eligibility", outcome: "deny", reason: "eligibility_facts_mismatch" };
  }
  return { gate: "platform_eligibility", outcome: "allow" };
}

export function evaluateSkillsQualificationGate(input: unknown): GateDecision {
  const value = ownData(input);
  if (!value || value.outcome !== "not_applicable") {
    return {
      gate: "skills_qualification",
      outcome: "deny",
      reason: "brain_does_not_consume_skills_qualification",
    };
  }
  return { gate: "skills_qualification", outcome: "not_applicable" };
}

export function evaluateProfileActivationGate(snapshot: unknown, capability: string): GateDecision {
  const value = ownData(snapshot);
  if (!value) {
    return { gate: "profile_activation", outcome: "deny", reason: "activation_snapshot_invalid" };
  }
  if (value.executionAuthority !== "none") {
    return {
      gate: "profile_activation",
      outcome: "deny",
      reason: "provider_execution_authority_forbidden",
    };
  }
  if (value.activationState !== "active" || !isRef(value.profileId)) {
    return { gate: "profile_activation", outcome: "deny", reason: "profile_inactive" };
  }
  if (
    !Array.isArray(value.exposedCapabilities) ||
    !value.exposedCapabilities.every((item) => isRef(item)) ||
    !value.exposedCapabilities.includes(capability)
  ) {
    return { gate: "profile_activation", outcome: "deny", reason: "capability_not_exposed" };
  }
  return { gate: "profile_activation", outcome: "allow" };
}

export function authorizeBrainCapability(input: unknown): CapabilityAuthorization {
  const value = ownData(input);
  if (!value) {
    return { ok: false, reason: "authorization_shape_invalid", gates: [] };
  }
  const elevation = elevationRejected(value);
  if (elevation) {
    return { ok: false, reason: elevation, gates: [] };
  }
  const facts = prepareProviderRuntimeFacts(value.facts);
  if (!facts) {
    return { ok: false, reason: "prepared_facts_invalid", gates: [] };
  }
  if (!(BRAIN_DECLARED_CAPABILITIES as readonly string[]).includes(facts.action)) {
    return { ok: false, reason: "undeclared_capability", gates: [] };
  }
  if (typeof value.expectedAgentId === "string" && value.expectedAgentId !== facts.agentId) {
    return { ok: false, reason: "cross_agent_denied", gates: [] };
  }
  if (typeof value.expectedTenantId === "string" && value.expectedTenantId !== facts.tenantId) {
    return { ok: false, reason: "cross_tenant_denied", gates: [] };
  }
  if (typeof value.expectedResource === "string" && value.expectedResource !== facts.resource) {
    return { ok: false, reason: "resource_denied", gates: [] };
  }
  const eligibility = evaluatePlatformEligibilityGate(value.platformEligibility, facts);
  const qualification = evaluateSkillsQualificationGate(value.skillsQualification);
  const activation = evaluateProfileActivationGate(value.profileActivation, facts.action);
  const gates = Object.freeze([eligibility, qualification, activation]);
  if (eligibility.outcome !== "allow") {
    return { ok: false, reason: eligibility.reason ?? "platform_eligibility_denied", gates };
  }
  if (qualification.outcome === "deny") {
    return { ok: false, reason: qualification.reason ?? "skills_qualification_denied", gates };
  }
  if (activation.outcome !== "allow") {
    return { ok: false, reason: activation.reason ?? "profile_activation_denied", gates };
  }
  return {
    ok: true,
    capability: facts.action as BrainDeclaredCapability,
    facts,
    gates,
  };
}

export const BRAIN_IDENTITY = Object.freeze({
  commit: LINKBRAIN_V2_COMMIT,
  tree: LINKBRAIN_V2_TREE,
} as const);

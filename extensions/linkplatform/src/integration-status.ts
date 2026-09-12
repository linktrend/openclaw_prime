import { parseStrictIsoTimestamp } from "./timestamps.js";

export const INTEGRATION_PROVIDERS = [
  "Platform",
  "Brain",
  "Skills",
  "Libraries",
  "Autowork",
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const INTEGRATION_STATES = [
  "available",
  "degraded",
  "offline",
  "unauthorized",
  "forbidden",
  "stale",
  "contract-incompatible",
  "disabled",
] as const;

export type IntegrationState = (typeof INTEGRATION_STATES)[number];

export type IntegrationStatusInput = {
  provider: unknown;
  state: unknown;
  contractVersion: unknown;
  observedAt: unknown;
  sourceRef?: unknown;
  sourceTimestamp?: unknown;
  narrative?: unknown;
};

export type IntegrationStatus = {
  provider: IntegrationProvider;
  state: IntegrationState;
  contractVersion: string;
  observedAt: string;
  sourceRef?: string;
  sourceTimestamp?: string;
  narrative?: string;
  current: boolean;
  nonAuthoritative: true;
};

export type IntegrationStatusError = {
  ok: false;
  error: "malformed";
  issues: string[];
};

export type IntegrationStatusResult = IntegrationStatus | IntegrationStatusError;

const MAX_NARRATIVE_LENGTH = 512;
const ALLOWED_STATUS_FIELDS = new Set([
  "provider",
  "state",
  "contractVersion",
  "observedAt",
  "sourceRef",
  "sourceTimestamp",
  "narrative",
]);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isIsoTimestamp = (value: unknown): value is string =>
  isNonEmptyString(value) && parseStrictIsoTimestamp(value) !== undefined;

const hasControlCharacters = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
      return true;
    }
  }
  return false;
};

const isNarrative = (value: unknown): value is string =>
  typeof value === "string" && value.length <= MAX_NARRATIVE_LENGTH && !hasControlCharacters(value);

export function normalizeIntegrationStatus(input: unknown): IntegrationStatusResult {
  const value = input as Partial<IntegrationStatusInput> | null;
  const issues: string[] = [];

  if (value === null || typeof value !== "object") {
    return { ok: false, error: "malformed", issues: ["input must be an object"] };
  }
  for (const field of Object.keys(value)) {
    if (!ALLOWED_STATUS_FIELDS.has(field)) {
      issues.push(`unknown field ${field}`);
    }
  }
  if (!INTEGRATION_PROVIDERS.includes(value.provider as IntegrationProvider)) {
    issues.push("provider is invalid");
  }
  if (!INTEGRATION_STATES.includes(value.state as IntegrationState)) {
    issues.push("state is invalid");
  }
  if (!isNonEmptyString(value.contractVersion)) {
    issues.push("contractVersion is required");
  }
  if (!isIsoTimestamp(value.observedAt)) {
    issues.push("observedAt must be an ISO timestamp");
  }
  if ("sourceRef" in value && !isNonEmptyString(value.sourceRef)) {
    issues.push("sourceRef must be a non-empty string");
  }
  if ("sourceTimestamp" in value && !isIsoTimestamp(value.sourceTimestamp)) {
    issues.push("sourceTimestamp must be an ISO timestamp");
  }
  if ("narrative" in value && !isNarrative(value.narrative)) {
    issues.push("narrative is invalid");
  }

  if (value.state === "stale") {
    if (!isNonEmptyString(value.sourceRef)) {
      issues.push("stale requires sourceRef");
    }
    if (!isIsoTimestamp(value.sourceTimestamp)) {
      issues.push("stale requires sourceTimestamp as an ISO timestamp");
    }
  }
  if (issues.length > 0) {
    return { ok: false, error: "malformed", issues };
  }

  const state = value.state as IntegrationState;
  return {
    provider: value.provider as IntegrationProvider,
    state,
    contractVersion: value.contractVersion as string,
    observedAt: value.observedAt as string,
    ...(isNonEmptyString(value.sourceRef) ? { sourceRef: value.sourceRef } : {}),
    ...(isIsoTimestamp(value.sourceTimestamp) ? { sourceTimestamp: value.sourceTimestamp } : {}),
    ...(isNarrative(value.narrative) ? { narrative: value.narrative } : {}),
    current: false,
    nonAuthoritative: true,
  };
}

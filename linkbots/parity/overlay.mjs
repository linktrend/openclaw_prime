import { readFileSync } from "node:fs";
import JSON5 from "json5";

const parityDirectory = new URL("./", import.meta.url);
const contract = JSON.parse(
  readFileSync(new URL("profile-preservation.contract.json", parityDirectory), "utf8"),
);
const requiredPlugins = new Set(
  JSON.parse(readFileSync(new URL("parity.contract.json", parityDirectory), "utf8")).image
    .requiredPlugins,
);

const EXACT_ALLOWED_PATHS = new Set([
  "agents.defaults.model.primary",
  "agents.defaults.model.fallbacks",
  "agents.defaults.thinkingDefault",
  "agents.defaults.models.openai/gpt-5.6-sol.params.thinking",
  "agents.defaults.models.openrouter/openai/gpt-5.6-luna.params.thinking",
  "agents.defaults.models.openai/gpt-5.6-sol.agentRuntime.id",
]);

const FORBIDDEN_SEGMENTS = new Set(contract.protectedDomains);
const BASELINE_KEYS = new Set([
  "agent",
  "runtimeRoot",
  "workspacePath",
  "stateDbPath",
  "configuredAgentIds",
  "topLevelKeys",
  "agentsKeys",
  "pluginIds",
  "channelIds",
  "model",
  "presence",
  "authorizationDatabase",
  "revocation",
  "identityFiles",
  "workspace",
  "nonLisaToolsFile",
]);
const BASELINE_MODEL_KEYS = new Set([
  "primary",
  "fallbacks",
  "thinkingDefault",
  "primaryThinking",
  "fallbackThinking",
]);
const BASELINE_PRESENCE_KEYS = new Set([
  "identity",
  "soul",
  "tools",
  "agents",
  "jobs",
  "schedules",
  "memory",
  "recipients",
]);

function isObject(value) {
  return value !== null && typeof value === "object";
}

function clone(value) {
  return structuredClone(value);
}

function leafPaths(value, prefix = []) {
  if (!isObject(value) || Array.isArray(value)) return [prefix.join(".")];
  const entries = Object.entries(value);
  if (entries.length === 0) return [prefix.join(".")];
  return entries.flatMap(([key, child]) => leafPaths(child, [...prefix, key]));
}

function isAllowedPath(path) {
  if (EXACT_ALLOWED_PATHS.has(path)) return true;
  const parts = path.split(".");
  return (
    parts.length === 4 &&
    parts[0] === "plugins" &&
    parts[1] === "entries" &&
    requiredPlugins.has(parts[2]) &&
    parts[3] === "enabled"
  );
}

function hasForbiddenSegment(path) {
  return path.split(".").some((segment) => FORBIDDEN_SEGMENTS.has(segment));
}

function pathParts(path) {
  for (const modelId of ["openai/gpt-5.6-sol", "openrouter/openai/gpt-5.6-luna"]) {
    const prefix = `agents.defaults.models.${modelId}`;
    if (path === prefix) return ["agents", "defaults", "models", modelId];
    if (path.startsWith(`${prefix}.`))
      return ["agents", "defaults", "models", modelId, ...path.slice(prefix.length + 1).split(".")];
  }
  return path.split(".");
}

function getAt(value, path) {
  return pathParts(path).reduce(
    (current, key) => (current == null ? undefined : current[key]),
    value,
  );
}

function setAt(value, path, nextValue) {
  const parts = pathParts(path);
  let cursor = value;
  for (const part of parts.slice(0, -1)) {
    if (!isObject(cursor[part]) || Array.isArray(cursor[part])) cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = clone(nextValue);
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortKeys(child)]),
  );
}

function withoutAllowedPaths(value, prefix = []) {
  if (Array.isArray(value))
    return value.map((child, index) => withoutAllowedPaths(child, [...prefix, String(index)]));
  if (!isObject(value)) return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    const path = [...prefix, key].join(".");
    if (isAllowedPath(path)) continue;
    const projected = withoutAllowedPaths(child, [...prefix, key]);
    if (projected !== undefined) result[key] = projected;
  }
  if (
    Object.keys(value).length > 0 &&
    Object.keys(result).length === 0 &&
    leafPaths(value, prefix).every(isAllowedPath)
  )
    return undefined;
  return sortKeys(result);
}

export function parseOverlay(source) {
  return typeof source === "string" ? JSON5.parse(source) : clone(source);
}

export function loadOverlay() {
  return parseOverlay(
    readFileSync(new URL("openclaw.common.patch.json5", parityDirectory), "utf8"),
  );
}

export function validateTechnicalOverlay(overlay) {
  const errors = [];
  for (const path of leafPaths(overlay)) {
    if (!path || !isAllowedPath(path))
      errors.push(`overlay path is not allowlisted: ${path || "<root>"}`);
    if (hasForbiddenSegment(path)) errors.push(`overlay path touches protected domain: ${path}`);
  }
  if (getAt(overlay, "agents.defaults.model.primary") !== "openai/gpt-5.6-sol")
    errors.push("primary must be OpenAI Sol");
  if (
    JSON.stringify(getAt(overlay, "agents.defaults.model.fallbacks")) !==
    JSON.stringify(["openrouter/openai/gpt-5.6-luna"])
  )
    errors.push("fallback must be the sole ordered OpenRouter Luna route");
  if (getAt(overlay, "agents.defaults.thinkingDefault") !== "low")
    errors.push("generic thinking default must be low");
  if (getAt(overlay, "agents.defaults.models.openai/gpt-5.6-sol.params.thinking") !== "low")
    errors.push("Sol thinking must be low");
  if (
    getAt(overlay, "agents.defaults.models.openrouter/openai/gpt-5.6-luna.params.thinking") !==
    "high"
  )
    errors.push("OpenRouter Luna thinking must be high");
  if (getAt(overlay, "agents.defaults.models.openai/gpt-5.6-sol.agentRuntime.id") !== "codex")
    errors.push("Sol runtime must remain Codex");
  if (getAt(overlay, "plugins.entries.googlechat.enabled") !== false)
    errors.push("Google Chat must remain disabled until its gates pass");
  return errors;
}

export function applyTechnicalOverlay(config, overlay = loadOverlay()) {
  const errors = validateTechnicalOverlay(overlay);
  if (errors.length) throw new Error(errors.join("; "));
  const next = clone(config);
  for (const path of leafPaths(overlay)) setAt(next, path, getAt(overlay, path));
  return next;
}

export function protectedFieldsEqual(before, after) {
  return JSON.stringify(withoutAllowedPaths(before)) === JSON.stringify(withoutAllowedPaths(after));
}

export function protectedFieldDiff(before, after) {
  return protectedFieldsEqual(before, after)
    ? []
    : ["protected config fields changed outside the technical overlay allowlist"];
}

export function validateTechnicalConfig(config) {
  const errors = [];
  if (getAt(config, "agents.defaults.model.primary") !== "openai/gpt-5.6-sol")
    errors.push("candidate primary is not OpenAI Sol");
  if (
    JSON.stringify(getAt(config, "agents.defaults.model.fallbacks")) !==
    JSON.stringify(["openrouter/openai/gpt-5.6-luna"])
  )
    errors.push("candidate fallback is not the sole ordered OpenRouter Luna route");
  if (getAt(config, "agents.defaults.thinkingDefault") !== "low")
    errors.push("candidate generic thinking default is not low");
  if (getAt(config, "agents.defaults.models.openai/gpt-5.6-sol.params.thinking") !== "low")
    errors.push("candidate Sol thinking is not low");
  if (
    getAt(config, "agents.defaults.models.openrouter/openai/gpt-5.6-luna.params.thinking") !==
    "high"
  )
    errors.push("candidate OpenRouter Luna thinking is not high");
  if (getAt(config, "plugins.entries.googlechat.enabled") !== false)
    errors.push("candidate Google Chat is not fail-closed");
  return errors;
}

export function validateStructuralBaseline(baseline, expectedAgent) {
  const errors = [];
  if (!isObject(baseline) || Array.isArray(baseline))
    return ["structural baseline must be an object"];
  for (const key of Object.keys(baseline))
    if (!BASELINE_KEYS.has(key))
      errors.push(`structural baseline contains non-structural field: ${key}`);
  for (const key of ["agent", "runtimeRoot", "workspacePath", "stateDbPath"])
    if (typeof baseline[key] !== "string")
      errors.push(`structural baseline field must be a string: ${key}`);
  if (expectedAgent !== undefined && baseline.agent !== expectedAgent)
    errors.push(`structural baseline is not bound to agent: ${expectedAgent}`);
  for (const key of [
    "configuredAgentIds",
    "topLevelKeys",
    "agentsKeys",
    "pluginIds",
    "channelIds",
  ]) {
    if (!Array.isArray(baseline[key]) || baseline[key].some((value) => typeof value !== "string"))
      errors.push(`structural baseline field must be a string array: ${key}`);
  }
  if (
    !isObject(baseline.model) ||
    Object.keys(baseline.model).some((key) => !BASELINE_MODEL_KEYS.has(key))
  )
    errors.push("structural baseline model contains non-structural fields");
  if (
    !isObject(baseline.presence) ||
    Object.keys(baseline.presence).some((key) => !BASELINE_PRESENCE_KEYS.has(key)) ||
    Object.values(baseline.presence).some((value) => typeof value !== "boolean")
  )
    errors.push("structural baseline presence contains non-structural fields");
  const exactObject = (value, keys, label) => {
    if (!isObject(value) || Array.isArray(value)) {
      errors.push(`structural baseline field must be an object: ${label}`);
      return false;
    }
    for (const key of Object.keys(value))
      if (!keys.includes(key))
        errors.push(`structural baseline ${label} contains non-structural field: ${key}`);
    for (const key of keys)
      if (!(key in value)) errors.push(`structural baseline field is required: ${label}.${key}`);
    return true;
  };
  if (exactObject(baseline.authorizationDatabase, ["path", "identity"], "authorizationDatabase")) {
    for (const key of ["path", "identity"])
      if (typeof baseline.authorizationDatabase[key] !== "string")
        errors.push(`structural baseline field must be a string: authorizationDatabase.${key}`);
  }
  if (exactObject(baseline.revocation, ["boundaryIdentity"], "revocation")) {
    if (typeof baseline.revocation.boundaryIdentity !== "string")
      errors.push("structural baseline field must be a string: revocation.boundaryIdentity");
  }
  if (!Array.isArray(baseline.identityFiles) || baseline.identityFiles.length === 0) {
    errors.push("structural baseline field must be a non-empty record array: identityFiles");
  } else {
    const expectedNames = [...(contract.structuralExpectations?.identityFiles ?? [])].sort();
    const actualNames = baseline.identityFiles.map((file) => file?.name).sort();
    if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames))
      errors.push(
        `structural baseline identityFiles must cover exactly: ${expectedNames.join(", ")}`,
      );
    for (const file of baseline.identityFiles) {
      if (!exactObject(file, ["name", "path", "exists"], "identityFiles")) continue;
      if (
        typeof file.name !== "string" ||
        typeof file.path !== "string" ||
        typeof file.exists !== "boolean"
      )
        errors.push(
          "structural baseline identityFiles records must contain name/path strings and exists boolean",
        );
    }
  }
  if (exactObject(baseline.workspace, ["path", "entries"], "workspace")) {
    if (typeof baseline.workspace.path !== "string")
      errors.push("structural baseline field must be a string: workspace.path");
    if (
      !Array.isArray(baseline.workspace.entries) ||
      baseline.workspace.entries.some((entry) => typeof entry !== "string")
    )
      errors.push("structural baseline field must be a string array: workspace.entries");
    if (baseline.workspace.path !== baseline.workspacePath)
      errors.push("structural baseline workspace.path must equal workspacePath");
  }
  if (exactObject(baseline.nonLisaToolsFile, ["path", "exists"], "nonLisaToolsFile")) {
    if (
      typeof baseline.nonLisaToolsFile.path !== "string" ||
      typeof baseline.nonLisaToolsFile.exists !== "boolean"
    )
      errors.push(
        "structural baseline nonLisaToolsFile must contain path string and exists boolean",
      );
    const toolsName = contract.structuralExpectations?.nonLisaToolsFile;
    if (toolsName && !baseline.nonLisaToolsFile.path.endsWith(`/${toolsName}`))
      errors.push(`structural baseline nonLisaToolsFile.path must end with ${toolsName}`);
  }
  return errors;
}

export function structuralBaselineEqual(before, after) {
  return JSON.stringify(before) === JSON.stringify(after);
}

export function structuralBaselineDiff(before, after) {
  return structuralBaselineEqual(before, after)
    ? []
    : ["protected runtime structure changed outside the technical overlay allowlist"];
}

export async function executeParityDeployment({
  agents,
  overlay = loadOverlay(),
  captureStructuralBaseline,
  backupRuntimeRoot,
  readConfig,
  writeConfig,
  validateConfig = validateTechnicalConfig,
  writeEphemeralReceipt,
  restoreRuntimeRoot,
}) {
  const receipt = { status: "prepared", agents: [], rollback: null };
  const prepared = [];
  const mutated = [];
  try {
    for (const agent of agents) {
      const baseline = await captureStructuralBaseline(agent);
      const baselineErrors = validateStructuralBaseline(baseline, agent);
      if (baselineErrors.length)
        throw new Error(`${agent}: unsafe structural baseline: ${baselineErrors.join("; ")}`);
      prepared.push({ agent, baseline });
      receipt.agents.push({ agent, baseline });
    }
    await writeEphemeralReceipt({ ...receipt, status: "baseline-captured" });

    for (const item of prepared) {
      const backup = await backupRuntimeRoot(item.agent);
      item.backup = backup;
    }
    await writeEphemeralReceipt({ ...receipt, status: "backups-captured" });

    for (const item of prepared) {
      const before = await readConfig(item.agent);
      const candidate = applyTechnicalOverlay(before, overlay);
      const validationErrors = validateConfig(candidate);
      if (validationErrors.length)
        throw new Error(
          `${item.agent}: candidate validation failed: ${validationErrors.join("; ")}`,
        );
      mutated.push(item);
      await writeConfig(item.agent, candidate);
      const after = await readConfig(item.agent);
      const protectedErrors = protectedFieldDiff(before, after);
      if (protectedErrors.length) throw new Error(`${item.agent}: ${protectedErrors.join("; ")}`);
      const afterBaseline = await captureStructuralBaseline(item.agent);
      const afterBaselineErrors = validateStructuralBaseline(afterBaseline, item.agent);
      if (afterBaselineErrors.length)
        throw new Error(
          `${item.agent}: unsafe post-write structural baseline: ${afterBaselineErrors.join("; ")}`,
        );
      const structuralErrors = structuralBaselineDiff(item.baseline, afterBaseline);
      if (structuralErrors.length) throw new Error(`${item.agent}: ${structuralErrors.join("; ")}`);
      const receiptAgent = receipt.agents.find((entry) => entry.agent === item.agent);
      receiptAgent.postWriteBaseline = afterBaseline;
      receiptAgent.status = "validated";
    }
    receipt.status = "complete";
    await writeEphemeralReceipt(receipt);
    return receipt;
  } catch (error) {
    const rollbackErrors = [];
    for (const item of [...mutated].reverse()) {
      try {
        await restoreRuntimeRoot(item.agent, item.backup);
      } catch (rollbackError) {
        rollbackErrors.push(`${item.agent}: ${String(rollbackError)}`);
      }
    }
    receipt.status = "rolled-back";
    receipt.rollback = { reason: String(error), errors: rollbackErrors };
    await writeEphemeralReceipt(receipt);
    throw Object.assign(
      new Error(`${String(error)}; rollback=${rollbackErrors.length ? "failed" : "complete"}`),
      { cause: error, receipt },
    );
  }
}

export const preservationContract = contract;

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import JSON5 from "json5";
import {
  preservationContract,
  validateTechnicalConfig,
  validateTechnicalOverlay,
} from "./overlay.mjs";

const parityDir = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(parityDir, "../..");
const errors = [];
const agents = ["lisa", "david", "eric", "sara", "jane"];
const requiredPlugins = [
  "openai",
  "codex",
  "acpx",
  "linkbrain",
  "linkskills",
  "openrouter",
  "telegram",
  "buzz",
  "googlechat",
];
const forbiddenPatchKeys = new Set([
  "identity",
  "workspace",
  "cwd",
  "agentDir",
  "state",
  "auth",
  "memory",
  "jobs",
  "cron",
  "channels",
  "channelBindings",
  "recipients",
  "conversations",
  "personality",
  "role",
  "responsibilities",
  "credentials",
  "secrets",
  "actorIdentity",
  "runtimeIdentity",
  "authorization",
  "authorizationDatabase",
  "privateContent",
  "session",
]);

function readJson5(filePath) {
  const source = readFileSync(filePath, "utf8");
  return JSON5.parse(source);
}

function readCompose(fileName, profile = false) {
  const filePath = path.join(parityDir, fileName);
  if (!existsSync(filePath)) {
    errors.push(`missing compose artifact: ${fileName}`);
    return null;
  }
  try {
    const args = ["compose", "-f", filePath];
    if (profile) args.push("--profile", "production");
    args.push("config", "--format", "json");
    return JSON.parse(
      execFileSync("docker", args, {
        cwd: parityDir,
        env: {
          ...process.env,
          OPENCLAW_PARITY_IMAGE:
            process.env.OPENCLAW_PARITY_IMAGE ??
            "local/openclaw-prime@sha256:0000000000000000000000000000000000000000000000000000000000000000",
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
  } catch (error) {
    errors.push(`compose parse failed for ${fileName}: ${String(error)}`);
    return null;
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertContains(value, expected, message) {
  if (!Array.isArray(value) || !value.includes(expected))
    errors.push(`${message}: missing ${expected}`);
}

function assertPort(service, port, message) {
  const published = service?.ports?.[0];
  if (
    !published ||
    published.host_ip !== "127.0.0.1" ||
    published.target !== port ||
    published.published !== String(port)
  ) {
    errors.push(`${message}: expected loopback ${port}, got ${JSON.stringify(service?.ports)}`);
  }
}

function walkKeys(value, prefix = "") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenPatchKeys.has(key)) errors.push(`common patch must not own ${prefix}${key}`);
    walkKeys(child, `${prefix}${key}.`);
  }
}

function assertNoCredentialLiterals(filePaths) {
  const credentialPatterns = [
    /sk-[A-Za-z0-9]/u,
    /AIza[A-Za-z0-9_-]{10,}/u,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
    /private_key\s*:/u,
    /Bearer\s+[A-Za-z0-9._-]{20,}/u,
    /client_secret\s*:/u,
  ];
  for (const filePath of filePaths) {
    const content = readFileSync(filePath, "utf8");
    if (credentialPatterns.some((pattern) => pattern.test(content))) {
      errors.push(`credential-shaped literal found in ${path.relative(root, filePath)}`);
    }
  }
}

let contract;
let patch;
let bindings;
try {
  contract = JSON.parse(readFileSync(path.join(parityDir, "parity.contract.json"), "utf8"));
  patch = readJson5(path.join(parityDir, "openclaw.common.patch.json5"));
  bindings = readJson5(path.join(parityDir, "agent-bindings.template.json5"));
} catch (error) {
  errors.push(`parity data parse failed: ${String(error)}`);
}

if (contract) {
  assertEqual(contract.agents, agents, "agents must be exactly lisa,david,eric,sara,jane");
  assertEqual(contract.image?.requiredPlugins, requiredPlugins, "required plugin IDs changed");
  assertEqual(contract.model?.primary, "openai/gpt-5.6-sol", "primary model changed");
  assertEqual(contract.model?.primaryProvider, "openai", "primary provider changed");
  assertEqual(contract.model?.primaryThinking, "low", "primary thinking changed");
  assertEqual(
    contract.model?.fallbacks,
    ["openrouter/openai/gpt-5.6-luna"],
    "fallback route changed",
  );
  assertEqual(contract.model?.fallbackProvider, "openrouter", "fallback provider changed");
  assertEqual(contract.model?.fallbackThinking, "high", "fallback thinking changed");
  assertEqual(
    contract.model?.fallbackTrigger,
    "qualifying-provider-or-model-failure-only",
    "fallback trigger changed",
  );
  assertEqual(contract.model?.loadBalancing, false, "routine load balancing must remain disabled");
  assertEqual(
    contract.googleChat,
    {
      pluginId: "googlechat",
      activation: "disabled-until-secretref",
      startupSafeWhenCredentialAbsent: true,
      operational: false,
    },
    "Google Chat gate changed",
  );
  assertEqual(
    contract.sourceEvidence?.baseCommit,
    "8f396c1eb7677d4dbece731eb2eb738d4f6a5891",
    "base commit changed",
  );
  assertEqual(
    contract.sourceEvidence?.baseTree,
    "39ae372d76d22a1b693de30877d94898f0ae0ae3",
    "base tree changed",
  );
  if (contract.sourceEvidence?.protectedIntegrated !== false)
    errors.push("candidate must remain non-protected-integrated");
  assertEqual(
    contract.preservationContract,
    {
      path: "profile-preservation.contract.json",
      overlayOnly: true,
      codingRoutingStatus: "HOLD",
    },
    "preservation contract binding changed",
  );
}

if (preservationContract) {
  assertEqual(preservationContract.schemaVersion, 1, "preservation contract schema changed");
  assertEqual(preservationContract.overlayOnly, true, "parity operation must remain overlay-only");
  assertEqual(
    preservationContract.sourceAuthority?.nonLisaCompleteProfileSource,
    "live-deployed-workspaces-only",
    "non-Lisa source authority changed",
  );
  assertEqual(
    preservationContract.codingRouting?.status,
    "HOLD",
    "Lisa coding-specific routing must remain an explicit HOLD",
  );
  assertEqual(
    preservationContract.structuralExpectations?.separateRuntimeRoot,
    true,
    "runtime roots must remain separate",
  );
  assertEqual(
    preservationContract.structuralExpectations?.separateWorkspace,
    true,
    "workspaces must remain separate",
  );
  assertEqual(
    preservationContract.structuralExpectations?.separateStateDatabase,
    true,
    "state databases must remain separate",
  );
  assertEqual(
    preservationContract.structuralExpectations?.independentRevocation,
    true,
    "revocation boundaries must remain independent",
  );
}

for (const plugin of requiredPlugins) {
  const manifestPath = path.join(root, "extensions", plugin, "openclaw.plugin.json");
  if (!existsSync(manifestPath)) {
    errors.push(`required plugin missing from source tree: ${plugin}`);
    continue;
  }
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assertEqual(manifest.id, plugin, `plugin id mismatch for ${plugin}`);
    if (plugin === "googlechat" && manifest.activation?.onStartup !== false)
      errors.push("Google Chat must remain off at startup");
  } catch (error) {
    errors.push(`plugin manifest parse failed for ${plugin}: ${String(error)}`);
  }
}

if (patch) {
  errors.push(...validateTechnicalOverlay(patch));
  assertEqual(
    patch.agents?.defaults?.model,
    {
      primary: "openai/gpt-5.6-sol",
      fallbacks: ["openrouter/openai/gpt-5.6-luna"],
    },
    "common model route changed",
  );
  assertEqual(patch.agents?.defaults?.thinkingDefault, "low", "common thinking default changed");
  assertEqual(
    patch.agents?.defaults?.models?.["openai/gpt-5.6-sol"]?.params?.thinking,
    "low",
    "Sol model thinking changed",
  );
  assertEqual(
    patch.agents?.defaults?.models?.["openrouter/openai/gpt-5.6-luna"]?.params?.thinking,
    "high",
    "Luna fallback thinking changed",
  );
  assertEqual(
    patch.agents?.defaults?.models?.["openai/gpt-5.6-sol"]?.agentRuntime?.id,
    "codex",
    "Codex runtime activation changed",
  );
  assertEqual(
    Object.keys(patch.plugins?.entries ?? {}).sort(),
    [...requiredPlugins].sort(),
    "plugin activation set changed",
  );
  for (const plugin of requiredPlugins) {
    const expectedEnabled = plugin === "googlechat" ? false : true;
    if (patch.plugins.entries[plugin]?.enabled !== expectedEnabled)
      errors.push(`plugin activation is not explicit for ${plugin}`);
  }
  walkKeys(patch);
  errors.push(...validateTechnicalConfig({ agents: patch.agents, plugins: patch.plugins }));
}

if (bindings) {
  assertEqual(Object.keys(bindings.agents ?? {}), agents, "binding agents changed");
  const seenRefs = new Set();
  for (const agent of agents) {
    const binding = bindings.agents[agent];
    for (const domain of ["platform", "brain", "skills", "openai", "openrouter"]) {
      if (!binding?.[domain]) errors.push(`missing ${domain} binding for ${agent}`);
      for (const ref of Object.values(binding?.[domain] ?? {})) {
        if (typeof ref !== "string" || !ref.startsWith("__SECRET_REF_") || !ref.endsWith("__"))
          errors.push(`non-SecretRef placeholder in ${agent}.${domain}`);
        if (seenRefs.has(ref)) errors.push(`reused identity/credential placeholder: ${ref}`);
        seenRefs.add(ref);
      }
    }
    assertEqual(
      binding?.googlechat?.activation,
      "disabled-until-secretref",
      `Google Chat gate changed for ${agent}`,
    );
    if (!binding?.googlechat?.serviceAccountRef?.includes(`_${agent.toUpperCase()}__`))
      errors.push(`Google Chat SecretRef is not agent-specific for ${agent}`);
    if (
      !Object.values(binding?.platform ?? {}).some((ref) =>
        ref.includes(`_${agent.toUpperCase()}__`),
      )
    )
      errors.push(`Platform binding is not agent-specific for ${agent}`);
    for (const domain of ["brain", "skills", "openai", "openrouter"]) {
      if (
        !Object.values(binding?.[domain] ?? {}).some((ref) =>
          ref.includes(`_${agent.toUpperCase()}__`),
        )
      )
        errors.push(`${domain} binding is not agent-specific for ${agent}`);
    }
  }
}

const lisaCompose = readCompose(
  contract?.topology?.lisa?.compose ?? "compose.server01.lisa.yml",
  true,
);
const fleetCompose = readCompose(
  contract?.topology?.fleet?.compose ?? "compose.server01.fleet.yml",
);
if (lisaCompose) {
  const service = lisaCompose.services?.lisa;
  assertEqual(lisaCompose.name, "linktrend-openclaw-lisa", "Lisa compose name changed");
  assertEqual(service?.container_name, "linktrend-openclaw-lisa", "Lisa container changed");
  assertPort(service, 18791, "Lisa port changed");
  assertEqual(
    lisaCompose.networks?.core?.name,
    "linktrend-core-services_default",
    "Lisa network changed",
  );
  assertContains(service?.command, "lisa", "Lisa command lost profile");
  assertContains(service?.command, "18791", "Lisa command lost port");
  if (
    !service?.volumes?.some(
      (volume) =>
        volume.source === "/srv/linktrend/runtime/openclaw/lisa" &&
        volume.target === "/var/lib/openclaw/lisa",
    )
  )
    errors.push("Lisa runtime root is not preserved");
  if (service?.volumes?.some((volume) => volume.source?.includes("/srv/openclaw/agents")))
    errors.push("invented Lisa runtime path remains");
}
if (fleetCompose) {
  assertEqual(fleetCompose.name, "linktrend-openclaw-leadership", "fleet compose name changed");
  assertEqual(
    Object.keys(fleetCompose.services ?? {}).sort(),
    ["eric", "david", "sara", "jane"].sort(),
    "fleet service set changed",
  );
  for (const agent of ["eric", "david", "sara", "jane"]) {
    const service = fleetCompose.services[agent];
    const port = contract.topology.fleet.ports[agent];
    assertEqual(
      service?.container_name,
      `linktrend-openclaw-${agent}`,
      `${agent} container changed`,
    );
    assertPort(service, port, `${agent} port changed`);
    assertContains(service?.command, agent, `${agent} command lost profile`);
    assertContains(service?.command, String(port), `${agent} command lost port`);
    if (
      !service?.volumes?.some(
        (volume) =>
          volume.source === `/srv/linktrend/runtime/openclaw/${agent}` &&
          volume.target === `/var/lib/openclaw/${agent}`,
      )
    )
      errors.push(`${agent} runtime root is not preserved`);
    if (service?.volumes?.some((volume) => volume.source?.includes("/srv/openclaw/agents")))
      errors.push(`invented ${agent} runtime path remains`);
  }
}

const parityFiles = [
  path.join(parityDir, "parity.contract.json"),
  path.join(parityDir, "openclaw.common.patch.json5"),
  path.join(parityDir, "agent-bindings.template.json5"),
  path.join(parityDir, "profile-preservation.contract.json"),
  path.join(parityDir, "compose.server01.lisa.yml"),
  path.join(parityDir, "compose.server01.fleet.yml"),
  ...agents.map((agent) => path.join(parityDir, "env", `${agent}.env`)),
];
assertNoCredentialLiterals(parityFiles.filter((filePath) => existsSync(filePath)));

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `parity contract valid: ${agents.length} agents, ${requiredPlugins.length} plugins, preserved Lisa/fleet topology`,
  );
}

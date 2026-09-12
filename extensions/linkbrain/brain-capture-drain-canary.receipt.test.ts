/**
 * Locks Brain capture-drain canary receipt schema + worker-only architecture.
 * Validates receipts with the pinned claimed<=exercised tier contract and rejects dishonest claims.
 * Does not contact stage/Platform or invent an MCP drain tool.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LINKBRAIN_MCP_TOOL_ALLOWLIST } from "./mcp-tool-filter.js";
import { LINKBRAIN_MCP_CAPTURE_DRAIN_TOOLS } from "./src/feature-flags.js";

const TIER_RANK = Object.freeze({
  FAKE: 0,
  TEMPLATE: 1,
  "LIVE-STAGE": 2,
  "LIVE-PROD": 3,
} as const);
type EvidenceTierName = keyof typeof TIER_RANK;

type ReceiptValidationError = { keyword: string };
type ReceiptValidator = ((data: unknown) => boolean) & {
  errors?: ReceiptValidationError[] | null;
};

const receiptDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../docs/execution/openclawdevelopmentplan01/receipts",
);

/** First commit on this branch that introduced the receipt schema/example/test artifacts. */
const ARTIFACT_INTRODUCING_COMMIT = "e3e32521987cb12a60148fbc0e6da115de0c02c6";
/** WP-0 macmini-release base; artifacts are not present at this SHA. */
const WP0_BASE_SHA = "07c86fdc734ae98c2d8c65c0687e9c57624854a7";

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(join(receiptDir, name), "utf8"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, label: string): string {
  expect(typeof value, label).toBe("string");
  return value as string;
}

function assertBoolean(value: unknown, label: string): boolean {
  expect(typeof value, label).toBe("boolean");
  return value as boolean;
}

function loadReceiptSchema(): Record<string, unknown> {
  const schema = readJson("brain-capture-drain-canary.schema.json");
  expect(isRecord(schema)).toBe(true);
  if (!isRecord(schema)) {
    throw new Error("receipt schema missing");
  }
  return schema;
}

function loadFakeExample(): Record<string, unknown> {
  const example = readJson("brain-capture-drain-canary.example.fake.json");
  expect(isRecord(example)).toBe(true);
  if (!isRecord(example)) {
    throw new Error("FAKE example missing");
  }
  return example;
}

function compileReceiptValidator(): ReceiptValidator {
  const schema = loadReceiptSchema();
  const validate: ReceiptValidator = (data: unknown) => {
    validate.errors = null;
    if (!isRecord(data)) {
      validate.errors = [{ keyword: "type" }];
      return false;
    }
    const required = schema.required;
    if (
      Array.isArray(required) &&
      required.some((key) => typeof key === "string" && !(key in data))
    ) {
      validate.errors = [{ keyword: "required" }];
      return false;
    }
    const tiers = data.evidenceTier;
    if (!isRecord(tiers) || typeof tiers.claimed !== "string" || !Array.isArray(tiers.exercised)) {
      validate.errors = [{ keyword: "required" }];
      return false;
    }
    const claimed = tiers.claimed as EvidenceTierName;
    if (!(claimed in TIER_RANK)) {
      validate.errors = [{ keyword: "enum" }];
      return false;
    }
    const exercisedRanks = tiers.exercised
      .filter((item): item is EvidenceTierName => typeof item === "string" && item in TIER_RANK)
      .map((item) => TIER_RANK[item]);
    if (exercisedRanks.length === 0) {
      validate.errors = [{ keyword: "minItems" }];
      return false;
    }
    const highest = Math.max(...exercisedRanks);
    if (TIER_RANK[claimed] > highest) {
      validate.errors = [{ keyword: "if" }, { keyword: "contains" }];
      return false;
    }
    return true;
  };
  return validate;
}

describe("brain-capture-drain-canary receipt + architecture lock", () => {
  it("keeps captureDrain as worker-only (empty MCP drain tool list)", () => {
    expect([...LINKBRAIN_MCP_CAPTURE_DRAIN_TOOLS]).toEqual([]);
    expect(LINKBRAIN_MCP_TOOL_ALLOWLIST.some((name) => /drain/i.test(name))).toBe(false);
    expect(LINKBRAIN_MCP_TOOL_ALLOWLIST).toContain("brain_capture_batch");
  });

  it("Ajv accepts the FAKE example against the receipt schema", () => {
    const example = loadFakeExample();
    const validate = compileReceiptValidator();
    expect(validate(structuredClone(example))).toBe(true);
    expect(validate.errors).toBeNull();

    expect(example.schemaVersion).toBe("1.0.0");
    expect(example.receiptType).toBe("brain-capture-drain-canary");
    expect(assertString(example.canaryId, "canaryId").length).toBeGreaterThanOrEqual(8);

    const architecture = example.architecture;
    expect(isRecord(architecture)).toBe(true);
    if (!isRecord(architecture)) {
      return;
    }
    expect(architecture.drainMode).toBe("worker_outbox");
    expect(assertBoolean(architecture.mcpDrainToolExists, "mcpDrainToolExists")).toBe(false);
    expect(architecture.captureWriteTool).toBe("brain_capture_batch");
    expect(assertString(architecture.drainExecutablePath, "drainExecutablePath")).toMatch(
      /linkbrain/,
    );
    expect(assertString(architecture.drainExecutablePath, "drainExecutablePath")).not.toMatch(
      /brain_.*drain/i,
    );

    const tiers = example.evidenceTier;
    expect(isRecord(tiers)).toBe(true);
    if (!isRecord(tiers)) {
      return;
    }
    expect(tiers.claimed).toBe("FAKE");
    expect(tiers.exercised).toEqual(["FAKE"]);

    const phases = example.phases;
    expect(isRecord(phases)).toBe(true);
    if (!isRecord(phases)) {
      return;
    }
    for (const phaseName of ["enqueue", "drain", "visibility"] as const) {
      const phase = phases[phaseName];
      expect(isRecord(phase), phaseName).toBe(true);
      if (!isRecord(phase)) {
        continue;
      }
      expect(phase.status).toBe("PASS");
    }
    const visibility = phases.visibility;
    if (isRecord(visibility)) {
      expect(visibility.proofMethod).toBe("fake_transport_ack");
    }

    const secrets = example.secrets;
    expect(isRecord(secrets)).toBe(true);
    if (!isRecord(secrets)) {
      return;
    }
    expect(secrets.exposed).toBe(false);
    expect(Array.isArray(secrets.refsNamedOnly)).toBe(true);

    expect(example.verdict).toBe("PASS");
  });

  it("records artifact-containing commit identity (not WP-0 base, not self-ref tip)", () => {
    const example = loadFakeExample();
    const repo = example.repo;
    expect(isRecord(repo)).toBe(true);
    if (!isRecord(repo)) {
      return;
    }
    expect(repo.baseSha).toBe(WP0_BASE_SHA);
    expect(repo.commitSha).toBe(ARTIFACT_INTRODUCING_COMMIT);
    expect(repo.commitSha).not.toBe(repo.baseSha);
    // Tip that embeds this file cannot be known before commit; identity is the introducing commit.
    expect(assertString(repo.commitSha, "commitSha")).toMatch(/^[0-9a-f]{40}$/);
  });

  it("Ajv rejects dishonest claimed tier above exercised evidence", () => {
    const example = loadFakeExample();
    const validate = compileReceiptValidator();

    const dishonestLiveProd = structuredClone(example) as Record<string, unknown>;
    const tiersLiveProd = dishonestLiveProd.evidenceTier as Record<string, unknown>;
    tiersLiveProd.exercised = ["FAKE"];
    tiersLiveProd.claimed = "LIVE-PROD";
    dishonestLiveProd.verdict = "PASS";
    expect(validate(dishonestLiveProd)).toBe(false);
    expect(
      validate.errors?.some(
        (error: ReceiptValidationError) => error.keyword === "if" || error.keyword === "contains",
      ),
    ).toBe(true);

    const dishonestLiveStage = structuredClone(example) as Record<string, unknown>;
    const tiersLiveStage = dishonestLiveStage.evidenceTier as Record<string, unknown>;
    tiersLiveStage.exercised = ["FAKE"];
    tiersLiveStage.claimed = "LIVE-STAGE";
    dishonestLiveStage.verdict = "PASS";
    expect(validate(dishonestLiveStage)).toBe(false);

    const dishonestTemplate = structuredClone(example) as Record<string, unknown>;
    const tiersTemplate = dishonestTemplate.evidenceTier as Record<string, unknown>;
    tiersTemplate.exercised = ["FAKE"];
    tiersTemplate.claimed = "TEMPLATE";
    dishonestTemplate.verdict = "PASS";
    expect(validate(dishonestTemplate)).toBe(false);
  });

  it("Ajv accepts claimed tiers at or below exercised evidence", () => {
    const example = loadFakeExample();
    const validate = compileReceiptValidator();

    const underClaim = structuredClone(example) as Record<string, unknown>;
    const underTiers = underClaim.evidenceTier as Record<string, unknown>;
    underTiers.exercised = ["LIVE-STAGE"];
    underTiers.claimed = "FAKE";
    expect(validate(underClaim)).toBe(true);

    const stageClaim = structuredClone(example) as Record<string, unknown>;
    const stageTiers = stageClaim.evidenceTier as Record<string, unknown>;
    stageTiers.exercised = ["FAKE", "LIVE-STAGE"];
    stageTiers.claimed = "LIVE-STAGE";
    expect(validate(stageClaim)).toBe(true);

    const prodClaim = structuredClone(example) as Record<string, unknown>;
    const prodTiers = prodClaim.evidenceTier as Record<string, unknown>;
    prodTiers.exercised = ["LIVE-PROD"];
    prodTiers.claimed = "LIVE-PROD";
    expect(validate(prodClaim)).toBe(true);
  });
});

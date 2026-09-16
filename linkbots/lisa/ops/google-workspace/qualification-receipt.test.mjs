import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
// Vitest tooling rewrites node:test only for approved Lisa .ts files.
// This overlay target is a .mjs, so a node:test import is collected as no
// Vitest suite (Full run 34753825165) while node:test still runs as a sidecar.
import { describe, it } from "vitest";
import {
  consumeInertQualifiedSkills,
  validateQualifiedSkillsReceipt,
  validateQualifiedSkillsReceiptFiles,
} from "./qualification-receipt.mjs";

const sourcePath = new URL("./receipts/qualified-skills.receipt.json", import.meta.url);
const source = JSON.parse(readFileSync(sourcePath, "utf8"));

function qualifiedCandidate() {
  return {
    ...source,
    status: "qualified",
    catalogueBinding: { ...source.catalogueBinding },
    catalogueIndexBinding: {
      ...source.catalogueIndexBinding,
      presentSkillIds: [...source.catalogueIndexBinding.requiredSkillIds],
      status: "qualified",
    },
    retrieval: { ...source.retrieval },
    qualification: {
      ...source.qualification,
      state: "qualified",
      executionGate: "enabled",
    },
    privacy: { ...source.privacy },
  };
}

describe("PKT-07 qualified Skills receipt validator", () => {
  it("rejects the committed source-only receipt", () => {
    assert.deepEqual(validateQualifiedSkillsReceipt(source, source), {
      ok: false,
      reason: "candidate_not_qualified",
    });
  });

  it("accepts a complete candidate bound to every source identity and digest", () => {
    assert.deepEqual(validateQualifiedSkillsReceipt(source, qualifiedCandidate()), { ok: true });
  });

  it("rejects provider pin drift even when the qualification flags are enabled", () => {
    const candidate = qualifiedCandidate();
    candidate.provider = {
      ...candidate.provider,
      commit: "0000000000000000000000000000000000000000",
    };
    assert.deepEqual(validateQualifiedSkillsReceipt(source, candidate), {
      ok: false,
      reason: "provider_commit_mismatch",
    });
  });

  it("rejects unknown top-level and nested fields", () => {
    const topLevelExtra = qualifiedCandidate();
    topLevelExtra.operatorNote = "ignored";
    assert.deepEqual(validateQualifiedSkillsReceipt(source, topLevelExtra), {
      ok: false,
      reason: "candidate_top_level_unknown_field_operatorNote",
    });

    const nestedExtra = qualifiedCandidate();
    nestedExtra.qualification.operatorNote = "ignored";
    assert.deepEqual(validateQualifiedSkillsReceipt(source, nestedExtra), {
      ok: false,
      reason: "candidate_qualification_unknown_field_operatorNote",
    });
  });

  it("rejects mutations to non-exact qualification and retrieval fields", () => {
    const reasonDrift = qualifiedCandidate();
    reasonDrift.qualification.reason = "qualified by an unbound provider";
    assert.deepEqual(validateQualifiedSkillsReceipt(source, reasonDrift), {
      ok: false,
      reason: "qualification_reason_mismatch",
    });

    const localExecutionDrift = qualifiedCandidate();
    localExecutionDrift.retrieval.localExecution = "provider runtime";
    assert.deepEqual(validateQualifiedSkillsReceipt(source, localExecutionDrift), {
      ok: false,
      reason: "retrieval_localExecution_mismatch",
    });
  });

  it("rejects mutations to privacy and unsupported capability declarations", () => {
    const privacyDrift = qualifiedCandidate();
    privacyDrift.privacy.accountIdentifiers = "recorded";
    assert.deepEqual(validateQualifiedSkillsReceipt(source, privacyDrift), {
      ok: false,
      reason: "privacy_accountIdentifiers_mismatch",
    });

    const unsupportedDrift = qualifiedCandidate();
    unsupportedDrift.unsupportedByDesign = [...source.unsupportedByDesign, "future operation"];
    assert.deepEqual(validateQualifiedSkillsReceipt(source, unsupportedDrift), {
      ok: false,
      reason: "unsupported_by_design_mismatch",
    });
  });

  it("rejects a partial catalogue rather than enabling the wrapper", () => {
    const candidate = qualifiedCandidate();
    candidate.catalogueIndexBinding = {
      ...candidate.catalogueIndexBinding,
      presentSkillIds: candidate.catalogueIndexBinding.presentSkillIds.slice(0, -1),
    };
    assert.deepEqual(validateQualifiedSkillsReceipt(source, candidate), {
      ok: false,
      reason: "required_skill_ids_not_present",
    });
  });

  it("consumes the committed receipt as an inert catalog", () => {
    assert.deepEqual(consumeInertQualifiedSkills(source), {
      ok: true,
      mode: "inert-source-catalog",
      skillIds: source.skills.map((skill) => skill.id),
      executionEnabled: false,
      copiedSkillBodies: false,
      providerRuntime: "not executed by OpenClaw",
    });
  });

  it("fails closed for unreadable or malformed receipt files", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "lisa-qualification-receipt-"));
    try {
      const candidatePath = path.join(directory, "candidate.json");
      writeFileSync(candidatePath, "not-json");
      assert.deepEqual(validateQualifiedSkillsReceiptFiles(sourcePath, candidatePath), {
        ok: false,
        reason: "receipt_unreadable_or_invalid_json",
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

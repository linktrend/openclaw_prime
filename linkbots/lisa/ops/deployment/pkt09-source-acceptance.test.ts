import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const receiptPath = join(root, "linkbots/lisa/ops/receipts/pkt-09-source-acceptance.receipt.json");

function sha256File(relativePath) {
  return createHash("sha256").update(readFileSync(join(root, relativePath))).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
    return `{${keys
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

describe("PKT-09 source-acceptance receipt rebind", () => {
  it("binds the protected post-PKT-01 development identity and artifact bytes", () => {
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    expect(receipt.packet).toMatchObject({ id: "PKT-09", githubIssue: 292 });
    expect(receipt.sourceBase).toEqual({
      repository: "linktrend/openclaw_prime",
      ref: "origin/development",
      commit: "8aba2013cffade07ce55f199bca1c5a6a24b46e4",
      tree: "e6f99b43529b1c34ba3b1090fa9ce19fb065a897",
    });
    expect(receipt.actions.vpsTouched).toBe(false);
    expect(receipt.actions.liveLisaTouched).toBe(false);
    expect(receipt.gates.vpsDeployment).toMatch(/^HOLD:/u);
    expect(sha256File(receipt.artifacts.backupContract.path)).toBe(
      receipt.artifacts.backupContract.sha256,
    );
    expect(sha256File(receipt.artifacts.receiptSchema.path)).toBe(receipt.artifacts.receiptSchema.sha256);
    for (const unit of receipt.artifacts.deploymentUnits) {
      expect(sha256File(unit.path)).toBe(unit.sha256);
    }
    expect(sha256File(receipt.artifacts.offlineRehearsal.path)).toBe(
      receipt.artifacts.offlineRehearsal.sha256,
    );
    const withoutDigest = { ...receipt };
    delete withoutDigest.receiptDigestSha256;
    expect(receipt.receiptDigestSha256).toBe(
      createHash("sha256").update(canonicalJson(withoutDigest)).digest("hex"),
    );
  });
});

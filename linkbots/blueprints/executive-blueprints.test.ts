import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  OPENCLAW_PROFILE_RUNTIME_PIN,
  PROFILE_EXCLUSION_KEYS,
  dryRunInactiveProfileProvisioning,
  parseCommonProfileManifest,
} from "../../src/agents/profile-manifest.js";
import { evaluateBlueprintLaunch } from "./business-plan-workflow.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const executiveBlueprintIds = ["eric", "david", "sara", "jane"] as const;

const expectedRoles = {
  eric: {
    roleRefs: ["role:cto", "scope:development", "scope:technical-operations"],
    capabilityClasses: ["development", "repository-review", "technical-operations"],
  },
  david: {
    roleRefs: ["role:cpo", "scope:go-to-market", "scope:product"],
    capabilityClasses: ["go-to-market", "product", "research"],
  },
  sara: {
    roleRefs: ["role:coo-cfo", "scope:business-operations", "scope:finance-review"],
    capabilityClasses: ["business-operations", "finance-review", "profile-administration"],
  },
  jane: {
    roleRefs: ["role:chief-trading-officer", "scope:market-research", "scope:strategy"],
    capabilityClasses: ["market-research", "risk-review", "trading-strategy"],
  },
} as const;

function readExecutiveBlueprint(id: (typeof executiveBlueprintIds)[number]): unknown {
  return JSON.parse(readFileSync(path.join(here, `${id}.profile-manifest.json`), "utf8"));
}

function readRoleSummary(id: (typeof executiveBlueprintIds)[number]): string {
  return readFileSync(path.join(here, "role-summaries", `${id}.md`), "utf8");
}

describe("inactive executive blueprints", () => {
  it("keeps all four blueprints schema-valid, inactive, and excluded from private runtime state", () => {
    for (const id of executiveBlueprintIds) {
      const input = readExecutiveBlueprint(id);
      const parsed = parseCommonProfileManifest(input);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) {
        continue;
      }
      expect(parsed.value.profileId).toBe(id);
      expect(parsed.value.activation).toBe("inactive");
      expect(parsed.value.providerPins.openclaw).toBe(OPENCLAW_PROFILE_RUNTIME_PIN);
      expect(parsed.value.roleRefs).toEqual([...expectedRoles[id].roleRefs]);
      expect(parsed.value.capabilityClasses).toEqual([...expectedRoles[id].capabilityClasses]);
      expect(parsed.value.exclusions).toEqual(
        Object.fromEntries(PROFILE_EXCLUSION_KEYS.map((key) => [key, true])),
      );
      expect(dryRunInactiveProfileProvisioning(parsed.value)).toEqual({
        ok: true,
        value: {
          mode: "dry-run",
          activation: "inactive",
          profileId: id,
          runtimeActor: false,
          credential: false,
          grant: false,
          session: false,
          channel: false,
          job: false,
          recipient: false,
          privateState: false,
          effects: [],
        },
      });

      const serialized = JSON.stringify({
        ...(input as Record<string, unknown>),
        exclusions: undefined,
      }).toLowerCase();
      for (const forbidden of [
        "lisa",
        "credential",
        "private state",
        "session",
        "recipient",
        "schedule",
        "account@",
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
    }
  });

  it("treats role summaries as projections, not capability grants", () => {
    for (const id of executiveBlueprintIds) {
      const summary = readRoleSummary(id);
      expect(summary).toMatch(/inactive blueprint/i);
      expect(summary).toMatch(/does not grant/i);
      expect(parseCommonProfileManifest(summary)).toMatchObject({
        ok: false,
        error: { code: "invalid-shape" },
      });
      const parsed = parseCommonProfileManifest(readExecutiveBlueprint(id));
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) {
        continue;
      }
      const withSummaryAuthority = parseCommonProfileManifest({
        ...(readExecutiveBlueprint(id) as object),
        roleSummary: summary,
        activation: "active",
      });
      expect(withSummaryAuthority.ok).toBe(true);
      if (!withSummaryAuthority.ok) {
        continue;
      }
      expect(dryRunInactiveProfileProvisioning(withSummaryAuthority.value)).toMatchObject({
        ok: false,
        error: { code: "activation-not-authorized" },
      });
    }
  });

  it("does not provision actors from disk manifests even with a matching launch record", () => {
    for (const id of executiveBlueprintIds) {
      const parsed = parseCommonProfileManifest(readExecutiveBlueprint(id));
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) {
        continue;
      }
      expect(dryRunInactiveProfileProvisioning(parsed.value).ok).toBe(true);
      expect(
        evaluateBlueprintLaunch(
          { profileId: id, activation: "inactive" },
          {
            blueprintProfileId: id,
            platformIdentityRef: `platform-identity:${id}`,
            grantsDigest: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            launchApprovalRef: `approval:launch-${id}`,
            approved: true,
          },
        ),
      ).toMatchObject({
        status: "launch-authority-verified",
        activation: "inactive",
        actions: [],
      });
    }
  });
});

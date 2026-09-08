import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertAuthClaimsShape11,
  AuthClaimsShapeError,
  PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION,
  PLATFORM_AUTH_CLAIMS_PREVIOUS_CONTRACT_VERSION,
} from "./src/auth-claims-1.1.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

function readFixture(...parts: string[]) {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, ...parts), "utf8"));
}

describe("linkskills AuthClaims 1.1.0 consumer conformance", () => {
  it("accepts positive 1.1.0 and service-null-org claims", () => {
    const positive = readFixture("identity", "positive-claim.json");
    expect(positive.platformContract).toBe(PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION);
    expect(() => assertAuthClaimsShape11(positive.claims)).not.toThrow();

    const serviceNull = readFixture("identity", "positive-service-null-org.json");
    expect(serviceNull.claims.actorKind).toBe("service");
    expect(serviceNull.claims.orgId).toBeNull();
    expect(() => assertAuthClaimsShape11(serviceNull.claims)).not.toThrow();
  });

  it("rejects stale 1.0.0 and persona null-org cases", () => {
    const legacy = readFixture("identity", "legacy-1.0.0-reject.json");
    expect(legacy.platformContract).toBe(PLATFORM_AUTH_CLAIMS_PREVIOUS_CONTRACT_VERSION);
    expect(() => assertAuthClaimsShape11(legacy.claims)).toThrow(AuthClaimsShapeError);

    const negative = readFixture("identity", "negative-claim.json");
    const personaNull = negative.cases.find(
      (c: { name: string }) => c.name === "missing_org_id_for_persona",
    );
    expect(personaNull).toBeTruthy();
    expect(() => assertAuthClaimsShape11(personaNull.claims)).toThrow(/orgId may be null only/);
  });

  it("auth lifecycle fixtures are 1.1.0-shaped", () => {
    for (const name of ["expired", "revoked", "wrong-audience", "wrong-scope"] as const) {
      const auth = readFixture("auth", `${name}.json`);
      expect(auth.platformContract).toBe(PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION);
      expect(() => assertAuthClaimsShape11(auth.claims)).not.toThrow();
    }
  });
});

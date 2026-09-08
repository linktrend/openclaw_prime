import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertAuthClaimsShape11,
  AuthClaimsShapeError,
  isAuthClaimsShape11,
  PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION,
  PLATFORM_AUTH_CLAIMS_PREVIOUS_CONTRACT_VERSION,
} from "./src/auth-claims-1.1.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

function readFixture(...parts: string[]) {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, ...parts), "utf8"));
}

describe("linkbrain AuthClaims 1.1.0 consumer conformance", () => {
  it("accepts positive 1.1.0 persona and service-null-org claims", () => {
    const positive = readFixture("identity", "positive-claim.json");
    expect(positive.platformContract).toBe(PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION);
    expect(positive.claims.claimContractVersion).toBe(PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION);
    expect(() => assertAuthClaimsShape11(positive.claims)).not.toThrow();
    expect(isAuthClaimsShape11(positive.claims)).toBe(true);

    const serviceNull = readFixture("identity", "positive-service-null-org.json");
    expect(serviceNull.claims.orgId).toBeNull();
    expect(serviceNull.claims.actorKind).toBe("service");
    expect(() => assertAuthClaimsShape11(serviceNull.claims)).not.toThrow();
  });

  it("rejects persona null orgId and stale 1.0.0 claims", () => {
    const personaNull = readFixture("identity", "negative-persona-null-org.json");
    expect(() => assertAuthClaimsShape11(personaNull.claims)).toThrow(AuthClaimsShapeError);

    const legacy = readFixture("identity", "legacy-1.0.0-reject.json");
    expect(legacy.platformContract).toBe(PLATFORM_AUTH_CLAIMS_PREVIOUS_CONTRACT_VERSION);
    expect(legacy.expect).toBe("reject");
    expect(() => assertAuthClaimsShape11(legacy.claims)).toThrow(/1\.1\.0/);
  });

  it("keeps lifecycle auth rejects on 1.1.0 contract version strings", () => {
    for (const name of [
      "expired",
      "revoked",
      "rotated",
      "wrong-audience",
      "wrong-scope",
    ] as const) {
      const auth = readFixture("auth", `${name}.json`);
      expect(auth.platformContract).toBe(PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION);
      expect(auth.claims.claimContractVersion).toBe(PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION);
      expect(() => assertAuthClaimsShape11(auth.claims)).not.toThrow();
    }
  });
});

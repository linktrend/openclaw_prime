import { describe, expect, it } from "vitest";
import { normalizeIntegrationStatus } from "./src/integration-status.js";

const base = { provider: "Platform", contractVersion: "1", observedAt: "2026-08-13T00:00:00Z" };

describe("normalizeIntegrationStatus", () => {
  it.each([
    "available",
    "degraded",
    "offline",
    "unauthorized",
    "forbidden",
    "stale",
    "contract-incompatible",
    "disabled",
  ])("normalizes %s", (state) => {
    const result = normalizeIntegrationStatus({
      ...base,
      state,
      sourceRef: "r",
      sourceTimestamp: base.observedAt,
    });
    expect(result).toMatchObject({ state, nonAuthoritative: true, current: false });
  });

  it("requires stale provenance", () => {
    expect(normalizeIntegrationStatus({ ...base, state: "stale" })).toMatchObject({
      ok: false,
      error: "malformed",
    });
    expect(
      normalizeIntegrationStatus({
        ...base,
        state: "stale",
        sourceRef: "r",
        sourceTimestamp: base.observedAt,
      }),
    ).toMatchObject({ current: false });
  });

  it("rejects malformed input", () => {
    expect(normalizeIntegrationStatus(null)).toMatchObject({ ok: false, error: "malformed" });
    expect(normalizeIntegrationStatus({ ...base, state: "unknown" })).toMatchObject({
      ok: false,
      error: "malformed",
    });
  });

  it("keeps forbidden distinct from unauthorized", () => {
    expect(normalizeIntegrationStatus({ ...base, state: "forbidden" })).toMatchObject({
      state: "forbidden",
    });
    expect(normalizeIntegrationStatus({ ...base, state: "unauthorized" })).toMatchObject({
      state: "unauthorized",
    });
  });

  it("preserves narrative only as untrusted data", () => {
    expect(
      normalizeIntegrationStatus({ ...base, state: "available", narrative: "claim" }),
    ).toMatchObject({ narrative: "claim", nonAuthoritative: true });
  });

  it.each([
    { label: "an object", narrative: { claim: "not a string" } },
    { label: "an overly long string", narrative: "x".repeat(513) },
    { label: "a string with control characters", narrative: "claim\u0000" },
  ])("rejects invalid narrative when it is $label", ({ narrative }) => {
    const result = normalizeIntegrationStatus({ ...base, state: "available", narrative });

    expect(result).toMatchObject({ ok: false, error: "malformed" });
  });

  it("rejects unknown and malformed supplied optional fields", () => {
    expect(
      normalizeIntegrationStatus({ ...base, state: "available", sourceRef: 42 }),
    ).toMatchObject({
      ok: false,
      error: "malformed",
    });
    expect(
      normalizeIntegrationStatus({ ...base, state: "available", sourceTimestamp: "nope" }),
    ).toMatchObject({ ok: false, error: "malformed" });
    expect(normalizeIntegrationStatus({ ...base, state: "available", extra: true })).toMatchObject({
      ok: false,
      error: "malformed",
    });
  });

  it.each(["observedAt", "sourceTimestamp"] as const)(
    "rejects nonexistent calendar dates in %s",
    (field) => {
      expect(
        normalizeIntegrationStatus({
          ...base,
          state: "available",
          [field]: "2026-02-30T00:00:00.000Z",
        }),
      ).toMatchObject({ ok: false, error: "malformed" });
    },
  );

  it("rejects a trailing newline in timestamps", () => {
    expect(
      normalizeIntegrationStatus({
        ...base,
        state: "available",
        observedAt: "2026-08-13T00:00:00.000Z\n",
      }),
    ).toMatchObject({ ok: false, error: "malformed" });
  });
});

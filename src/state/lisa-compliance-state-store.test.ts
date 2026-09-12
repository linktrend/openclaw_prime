import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LISA_PRIVATE_HEALTH_FILENAME } from "./lisa-compliance-state-schema.js";
import {
  calculateLisaHydrationConsumedMl,
  calculateLisaSleepDurationMinutes,
  classifyLisaSelfieReport,
  mapLisaCapacityForWork,
  recordLisaBatteryObservation,
  recordLisaHealthOwnership,
  recordLisaHydrationCheckpoint,
  recordLisaSelfieDay,
  recordLisaWorkCapacity,
  redactLisaComplianceForAudience,
  resolveLisaPrivateHealthPath,
  type LisaComplianceStoreOptions,
} from "./lisa-compliance-state-store.js";
import { OPENCLAW_AGENT_SCHEMA_VERSION } from "./openclaw-agent-db-contract.js";
import {
  closeOpenClawAgentDatabasesForTest,
  openOpenClawAgentDatabase,
} from "./openclaw-agent-db.js";

const dirs: string[] = [];

afterEach(() => {
  closeOpenClawAgentDatabasesForTest();
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function storeOptions(): LisaComplianceStoreOptions {
  const dir = mkdtempSync(join(tmpdir(), "lisa-compliance-"));
  dirs.push(dir);
  return {
    agentId: "lisa",
    path: join(dir, "agent.sqlite"),
    agentStateDir: join(dir, "state"),
  };
}

describe("Lisa private compliance state", () => {
  it("owns the dedicated health DB path and permissions without replacing it", () => {
    const options = storeOptions();
    const ownership = recordLisaHealthOwnership(options, 1);
    expect(ownership.databasePath).toBe(join(options.agentStateDir!, LISA_PRIVATE_HEALTH_FILENAME));
    expect(ownership.backupClass).toBe("separated-private");
    expect(ownership.replacesHealthDb).toBe(false);
    expect(statSync(options.agentStateDir!).mode & 0o777).toBe(0o700);
    writeFileSync(ownership.databasePath, "synthetic-health-bytes");
    expect(resolveLisaPrivateHealthPath(options.agentStateDir!)).toBe(ownership.databasePath);
    const database = openOpenClawAgentDatabase(options);
    expect(
      database.db.prepare("SELECT replaced_health_db FROM lisa_compliance_health_ownership").get(),
    ).toEqual({ replaced_health_db: 0 });
    expect(database.db.prepare("PRAGMA user_version").get()).toEqual({
      user_version: OPENCLAW_AGENT_SCHEMA_VERSION,
    });
  });

  it("maps work capacity without cause and calculates synthetic hydration and sleep", () => {
    const options = storeOptions();
    expect(mapLisaCapacityForWork("high")).toBe("normal");
    const capacity = recordLisaWorkCapacity(options, { workCapacity: "high", effectiveAtMs: 1 });
    expect(capacity).toEqual({
      workCapacity: "high",
      externalCapacity: "normal",
      causeRecorded: false,
    });
    expect(calculateLisaHydrationConsumedMl(3)).toBe(3_000);
    expect(calculateLisaHydrationConsumedMl(9)).toBe("not_reported");
    expect(calculateLisaSleepDurationMinutes(1_000, 1_000 + 8 * 60 * 60 * 1_000)).toBe(480);
    const hydration = recordLisaHydrationCheckpoint(options, {
      localDate: "synthetic-date",
      checkpoint: "morning",
      bottles: 2,
      sleepAtMs: 1_000,
      wakeAtMs: 1_000 + 60 * 60 * 1_000,
      nowMs: 2,
    });
    expect(hydration).toEqual({ consumedMl: 2_000, sleepMinutes: 60 });
  });

  it("records battery and selfie machines with plugged-in and midnight rules", () => {
    const options = storeOptions();
    const plugged = recordLisaBatteryObservation(options, {
      atMs: 0,
      percentage: 34,
      plugged: true,
      context: "desk",
      sourceEventId: "battery-plugged",
    });
    expect(plugged.alertIdempotencyKey).toBeNull();
    const due = recordLisaBatteryObservation(options, {
      atMs: 1,
      percentage: 35,
      plugged: false,
      context: "discharging",
      sourceEventId: "battery-35",
    });
    expect(due.alertIdempotencyKey).toBe("battery-35:35:1");
    expect(
      recordLisaBatteryObservation(options, {
        atMs: 2,
        percentage: 35,
        plugged: false,
        context: "discharging",
        sourceEventId: "battery-35",
      }).alertIdempotencyKey,
    ).toBe("battery-35:35:1");
    expect(classifyLisaSelfieReport(18, 0, "s-1", "taken")).toBe("Completed");
    expect(classifyLisaSelfieReport(22, 1, "s-2", "completed")).toBe("Reported Late");
    expect(
      recordLisaSelfieDay(options, {
        localDate: "synthetic-day",
        hour: 18,
        minute: 0,
        sourceEventId: "s-1",
        text: "taken",
        nowMs: 3,
      }).status,
    ).toBe("Completed");
    expect(
      recordLisaSelfieDay(options, {
        localDate: "synthetic-missed",
        hour: 0,
        minute: 0,
        sourceEventId: "midnight",
        midnightClose: true,
        nowMs: 4,
      }),
    ).toEqual({ status: "Missed", reminder: true });
  });

  it("fails closed for private leakage into work, provider, log, telemetry, export, fixture, and subordinate views", () => {
    for (const audience of [
      "work",
      "provider",
      "log",
      "telemetry",
      "export",
      "fixture",
      "subordinate",
    ] as const) {
      expect(() =>
        redactLisaComplianceForAudience({ note: "private health mood stress" }, audience),
      ).toThrow(/must not leak/);
    }
    expect(
      redactLisaComplianceForAudience(
        { batteryStatus: "Battery: 50% (unplugged)", mood: 3 },
        "flash",
      ),
    ).toEqual({ batteryStatus: "Battery: 50% (unplugged)" });
    expect(redactLisaComplianceForAudience({ title: "Weekly plan" }, "work")).toEqual({});
  });
});

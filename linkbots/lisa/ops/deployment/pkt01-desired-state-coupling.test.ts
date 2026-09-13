import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LISA_JOB_SCHEDULE_METADATA, LISA_JOB_TIME_ZONE } from "../jobs/lisa-job-contracts.js";
import { LISA_JOB_DESIRED_STATE } from "../jobs/lisa-job-desired-state.js";
import { BACKUP_TIMER_TEMPLATE, LISA_BACKUP_ONCALENDAR } from "./deployment.js";

const here = dirname(fileURLToPath(import.meta.url));

describe("PKT-09 consumes accepted PKT-01 backup desired state", () => {
  it("keeps backup systemd-owned at the PKT-01 05:30 Asia/Taipei window", () => {
    expect(LISA_JOB_DESIRED_STATE.excludedCronFamilies).toEqual(["librarian", "backup"]);
    expect(LISA_JOB_TIME_ZONE).toBe("Asia/Taipei");
    expect(LISA_JOB_SCHEDULE_METADATA.backup.localTimes).toEqual(["05:30"]);
    expect(LISA_JOB_SCHEDULE_METADATA.backup.enabled).toBe(false);
    expect(LISA_BACKUP_ONCALENDAR).toBe("*-*-* 05:30:00 Asia/Taipei");
    expect(BACKUP_TIMER_TEMPLATE).toContain(`OnCalendar=${LISA_BACKUP_ONCALENDAR}`);
    const checkedInTimer = readFileSync(join(here, "linktrend-lisa-backup.timer"), "utf8");
    expect(checkedInTimer).toContain(`OnCalendar=${LISA_BACKUP_ONCALENDAR}`);
    expect(checkedInTimer).not.toMatch(/openclaw cron/u);
  });
});

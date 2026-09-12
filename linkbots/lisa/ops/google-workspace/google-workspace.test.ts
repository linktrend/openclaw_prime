import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  consumeInertQualifiedSkills,
  validateQualifiedSkillsReceipt,
} from "./qualification-receipt.mjs";

const root = path.resolve("linkbots/lisa/ops/google-workspace");
const lisaSafe = path.join(root, "tools/bin/lisa-safe");
const tasks = path.join(root, "tools/bin/lisa-carlos-tasks");
const installer = path.join(root, "gws-linux-install.sh");

function makeFixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "lisa-gws-wrapper-"));
  const configRoot = path.join(directory, "google-workspace");
  const workRoot = path.join(directory, "workspace");
  const executionRoot = path.join(directory, "execution");
  const homeRoot = path.join(directory, "home");
  mkdirSync(path.join(configRoot, "lisa"), { recursive: true, mode: 0o700 });
  mkdirSync(path.join(configRoot, "carlos-tasks"), { recursive: true, mode: 0o700 });
  mkdirSync(workRoot, { recursive: true, mode: 0o700 });
  mkdirSync(path.join(workRoot, "downloads"), { recursive: true, mode: 0o700 });
  mkdirSync(executionRoot, { recursive: true, mode: 0o555 });
  mkdirSync(homeRoot, { recursive: true, mode: 0o555 });
  chmodSync(executionRoot, 0o555);
  chmodSync(homeRoot, 0o555);
  for (const identity of ["lisa", "carlos-tasks"]) {
    writeFileSync(path.join(configRoot, identity, "credentials.enc"), "synthetic-encrypted", {
      mode: 0o600,
    });
    writeFileSync(path.join(configRoot, identity, ".encryption_key"), "synthetic-file-key", {
      mode: 0o600,
    });
  }
  const sourceSkillsReceipt = JSON.parse(
    readFileSync(path.join(root, "receipts/qualified-skills.receipt.json"), "utf8"),
  ) as {
    catalogueIndexBinding: { requiredSkillIds: string[]; [key: string]: unknown };
    qualification: Record<string, unknown>;
    retrieval: Record<string, unknown>;
    privacy: Record<string, unknown>;
    skills: Array<Record<string, unknown>>;
    unsupportedByDesign: unknown[];
    [key: string]: unknown;
  };
  const syntheticQualified = {
    ...sourceSkillsReceipt,
    status: "qualified",
    catalogueBinding: { ...(sourceSkillsReceipt.catalogueBinding as Record<string, unknown>) },
    catalogueIndexBinding: {
      ...sourceSkillsReceipt.catalogueIndexBinding,
      presentSkillIds: [...sourceSkillsReceipt.catalogueIndexBinding.requiredSkillIds],
      status: "qualified",
    },
    retrieval: { ...sourceSkillsReceipt.retrieval },
    qualification: {
      ...sourceSkillsReceipt.qualification,
      state: "qualified",
      executionGate: "enabled",
    },
    privacy: { ...sourceSkillsReceipt.privacy },
    skills: sourceSkillsReceipt.skills.map((skill) => ({ ...skill })),
    unsupportedByDesign: [...sourceSkillsReceipt.unsupportedByDesign],
  };
  assert.deepEqual(validateQualifiedSkillsReceipt(sourceSkillsReceipt, syntheticQualified), {
    ok: true,
  });
  writeFileSync(
    path.join(configRoot, "qualified-skills.receipt.json"),
    JSON.stringify(syntheticQualified),
    { mode: 0o600 },
  );
  const fakeGws = path.join(directory, "gws");
  writeFileSync(
    fakeGws,
    '#!/bin/sh\nprintf "cwd=%s\\n" "$PWD"\nprintf "home=%s\\n" "$HOME"\nprintf "config=%s\\n" "$GOOGLE_WORKSPACE_CLI_CONFIG_DIR"\nprintf "token=%s\\n" "${GOOGLE_WORKSPACE_CLI_TOKEN:-}"\nprintf "adc=%s\\n" "${GOOGLE_APPLICATION_CREDENTIALS:-}"\nprintf "%s\\n" "$@"\nwhile [ "$#" -gt 0 ]; do\n  if [ "$1" = "--output" ]; then\n    shift\n    printf synthetic-download > "$1"\n    break\n  fi\n  shift\ndone\n',
    { mode: 0o700 },
  );
  chmodSync(fakeGws, 0o700);
  return { directory, configRoot, workRoot, executionRoot, homeRoot, fakeGws };
}

function run(
  script: string,
  args: string[],
  fixture: ReturnType<typeof makeFixture>,
  extraEnv: Record<string, string> = {},
) {
  return spawnSync(script, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      LISA_GOOGLE_WORKSPACE_CONFIG_ROOT: fixture.configRoot,
      LISA_GOOGLE_WORKSPACE_WORK_DIR: fixture.workRoot,
      LISA_GOOGLE_WORKSPACE_EXEC_CWD: fixture.executionRoot,
      LISA_GOOGLE_WORKSPACE_HOME_DIR: fixture.homeRoot,
      LISA_GWS_BIN: fixture.fakeGws,
      LISA_GWS_NODE_BIN: process.execPath,
      ...extraEnv,
    },
  });
}

describe("VPS Lisa Google Workspace wrappers", () => {
  it("routes Lisa Calendar through the Lisa config and never through a Mac path", () => {
    const fixture = makeFixture();
    try {
      const result = run(
        lisaSafe,
        [
          "calendar-insert",
          "--calendar",
          "opaque_lisa-workspace_calendar_work",
          "--summary",
          "Synthetic test event",
          "--start",
          "2026-08-14T10:00:00+08:00",
          "--end",
          "2026-08-14T10:30:00+08:00",
          "--attendee",
          "test@linktrend.media",
          "--dry-run",
        ],
        fixture,
      );
      assert.equal(result.status, 0, result.stderr);
      const captured = result.stdout;
      assert.match(captured, new RegExp(`${realpathSync(fixture.configRoot)}/lisa`));
      assert.match(captured, new RegExp(`cwd=${realpathSync(fixture.executionRoot)}`));
      assert.match(captured, new RegExp(`home=${realpathSync(fixture.homeRoot)}`));
      assert.match(captured, /^token=$/mu);
      assert.match(captured, /^adc=$/mu);
      assert.match(captured, /calendar\n\+insert/);
      assert.match(captured, /--dry-run/);
      assert.doesNotMatch(captured, /homebrew|opt\/homebrew|Applications/);

      const listedCalendars = run(
        lisaSafe,
        [
          "calendar-list",
          "--calendar",
          "opaque_lisa-workspace_calendar_work",
          "--max-results",
          "1",
        ],
        fixture,
      );
      assert.equal(listedCalendars.status, 0, listedCalendars.stderr);
      assert.match(listedCalendars.stdout, /calendar\ncalendarList\nlist/);
      assert.match(listedCalendars.stdout, /--calendar\nopaque_lisa-workspace_calendar_work/);
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  it("keeps Calendar event inspection and mutation bounded to explicit ids", () => {
    const fixture = makeFixture();
    try {
      const listed = run(
        lisaSafe,
        [
          "calendar-events-list",
          "--calendar",
          "opaque_lisa-workspace_calendar_routine",
          "--time-min",
          "2026-08-19T00:00:00+08:00",
          "--time-max",
          "2026-08-20T00:00:00+08:00",
          "--single-events",
          "--max-results",
          "20",
        ],
        fixture,
      );
      assert.equal(listed.status, 0, listed.stderr);
      assert.match(listed.stdout, /calendar\nevents\nlist/);
      assert.match(listed.stdout, /opaque_lisa-workspace_calendar_routine/);
      assert.match(listed.stdout, /"singleEvents":true/);

      const fetched = run(
        lisaSafe,
        [
          "calendar-event-get",
          "--calendar",
          "opaque_lisa-workspace_calendar_routine",
          "--event",
          "event_1",
        ],
        fixture,
      );
      assert.equal(fetched.status, 0, fetched.stderr);
      assert.match(fetched.stdout, /calendar\nevents\nget/);

      const patched = run(
        lisaSafe,
        [
          "calendar-event-patch",
          "--calendar",
          "opaque_lisa-workspace_calendar_routine",
          "--event",
          "event_1",
          "--summary",
          "Recovery break",
          "--start",
          "2026-08-19T10:15:00+08:00",
          "--end",
          "2026-08-19T11:00:00+08:00",
          "--dry-run",
        ],
        fixture,
      );
      assert.equal(patched.status, 0, patched.stderr);
      const patchArgs = patched.stdout.split("\n");
      const patchJson = patchArgs[patchArgs.indexOf("--json") + 1];
      assert.deepEqual(JSON.parse(patchJson ?? ""), {
        summary: "Recovery break",
        start: { dateTime: "2026-08-19T10:15:00+08:00", timeZone: "Asia/Taipei" },
        end: { dateTime: "2026-08-19T11:00:00+08:00", timeZone: "Asia/Taipei" },
      });

      const recurring = run(
        lisaSafe,
        [
          "calendar-event-patch",
          "--calendar",
          "opaque_lisa-workspace_calendar_routine",
          "--event",
          "event_1",
          "--weekdays",
          "MO,WE,FR",
          "--dry-run",
        ],
        fixture,
      );
      assert.equal(recurring.status, 0, recurring.stderr);
      const recurringArgs = recurring.stdout.split("\n");
      const recurringJson = recurringArgs[recurringArgs.indexOf("--json") + 1];
      assert.deepEqual(JSON.parse(recurringJson ?? ""), {
        recurrence: ["RRULE:FREQ=WEEKLY;WKST=MO;BYDAY=MO,WE,FR"],
      });

      const inserted = run(
        lisaSafe,
        [
          "calendar-insert",
          "--calendar",
          "opaque_lisa-workspace_calendar_routine",
          "--summary",
          "Recurring test event",
          "--start",
          "2026-08-20T17:30:00+08:00",
          "--end",
          "2026-08-20T18:30:00+08:00",
          "--weekdays",
          "TU,TH",
          "--dry-run",
        ],
        fixture,
      );
      assert.equal(inserted.status, 0, inserted.stderr);
      const insertArgs = inserted.stdout.split("\n");
      const insertJson = insertArgs[insertArgs.indexOf("--json") + 1];
      assert.deepEqual(JSON.parse(insertJson ?? ""), {
        summary: "Recurring test event",
        start: { dateTime: "2026-08-20T17:30:00+08:00", timeZone: "Asia/Taipei" },
        end: { dateTime: "2026-08-20T18:30:00+08:00", timeZone: "Asia/Taipei" },
        recurrence: ["RRULE:FREQ=WEEKLY;WKST=MO;BYDAY=TU,TH"],
      });

      const deleted = run(
        lisaSafe,
        [
          "calendar-event-delete",
          "--calendar",
          "opaque_lisa-workspace_calendar_routine",
          "--event",
          "event_1",
          "--dry-run",
        ],
        fixture,
      );
      assert.equal(deleted.status, 0, deleted.stderr);
      assert.match(deleted.stdout, /calendar\nevents\ndelete/);
      assert.match(deleted.stdout, /--dry-run/);
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  it("denies inaccessible account/calendar bindings and scope escalation", () => {
    const fixture = makeFixture();
    try {
      const foreignCalendar = run(
        lisaSafe,
        ["calendar-events-list", "--calendar", "carlos.private@example.invalid"],
        fixture,
      );
      assert.equal(foreignCalendar.status, 64);
      assert.match(foreignCalendar.stderr, /non-opaque shape/);
      assert.equal(foreignCalendar.stdout, "");

      const unboundCalendar = run(
        lisaSafe,
        ["calendar-event-get", "--calendar", "private_calendar", "--event", "event_1"],
        fixture,
      );
      assert.equal(unboundCalendar.status, 64);
      assert.match(unboundCalendar.stderr, /non-opaque shape/);
      assert.equal(unboundCalendar.stdout, "");

      const inaccessibleOpaqueCalendar = run(
        lisaSafe,
        ["calendar-event-get", "--calendar", "opaque_private_calendar", "--event", "event_1"],
        fixture,
      );
      assert.equal(inaccessibleOpaqueCalendar.status, 64);
      assert.match(inaccessibleOpaqueCalendar.stderr, /not in the approved Lisa allowlist/);
      assert.equal(inaccessibleOpaqueCalendar.stdout, "");

      const unboundAgenda = run(
        lisaSafe,
        ["calendar-agenda", "--calendar", "private_calendar", "--today"],
        fixture,
      );
      assert.equal(unboundAgenda.status, 64);
      assert.match(unboundAgenda.stderr, /non-opaque shape/);
      assert.equal(unboundAgenda.stdout, "");

      const missingAgendaBinding = run(lisaSafe, ["calendar-agenda", "--today"], fixture);
      assert.equal(missingAgendaBinding.status, 64);
      assert.match(missingAgendaBinding.stderr, /explicit opaque --calendar binding/);
      assert.equal(missingAgendaBinding.stdout, "");

      const missingListBinding = run(lisaSafe, ["calendar-list"], fixture);
      assert.equal(missingListBinding.status, 64);
      assert.match(missingListBinding.stderr, /explicit opaque --calendar binding/);
      assert.equal(missingListBinding.stdout, "");

      const unavailableReceiptPath = path.join(fixture.configRoot, "qualified-skills.receipt.json");
      const unavailableReceipt = JSON.parse(readFileSync(unavailableReceiptPath, "utf8")) as Record<
        string,
        unknown
      >;
      unavailableReceipt.status = "qualification-required";
      writeFileSync(unavailableReceiptPath, JSON.stringify(unavailableReceipt), { mode: 0o600 });
      const unavailableSmoke = run(lisaSafe, ["smoke-gws"], fixture);
      assert.equal(unavailableSmoke.status, 64);
      assert.match(unavailableSmoke.stderr, /qualified Skills receipt prerequisite is unavailable/);
      assert.equal(unavailableSmoke.stdout, "");

      const scopeArgument = run(
        lisaSafe,
        ["drive-list", "--scope", "https://www.googleapis.com/auth/cloud-platform"],
        fixture,
      );
      assert.equal(scopeArgument.status, 64);
      assert.equal(scopeArgument.stdout, "");

      const inheritedScope = run(lisaSafe, ["drive-list"], fixture, {
        GOOGLE_WORKSPACE_CLI_SCOPES: "https://www.googleapis.com/auth/cloud-platform",
      });
      assert.equal(inheritedScope.status, 64);
      assert.match(inheritedScope.stderr, /inherited auth\/config environment/);
      assert.equal(inheritedScope.stdout, "");
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  it("fails closed on source-only or flags-only Skills receipts before gws", () => {
    const fixture = makeFixture();
    const receiptPath = path.join(fixture.configRoot, "qualified-skills.receipt.json");
    const sourceReceipt = JSON.parse(
      readFileSync(path.join(root, "receipts/qualified-skills.receipt.json"), "utf8"),
    ) as {
      catalogueIndexBinding: { requiredSkillIds: string[]; [key: string]: unknown };
      [key: string]: unknown;
    };
    try {
      writeFileSync(receiptPath, JSON.stringify(sourceReceipt), { mode: 0o600 });
      const sourceOnly = run(lisaSafe, ["docs-read", "--document", "document_1"], fixture);
      assert.equal(sourceOnly.status, 64);
      assert.match(sourceOnly.stderr, /qualified Skills receipt prerequisite is unavailable/);
      assert.equal(sourceOnly.stdout, "");

      writeFileSync(
        receiptPath,
        JSON.stringify({
          ...sourceReceipt,
          status: "qualified",
          qualification: { state: "qualified", executionGate: "enabled" },
          catalogueIndexBinding: {
            ...sourceReceipt.catalogueIndexBinding,
            presentSkillIds: sourceReceipt.catalogueIndexBinding.requiredSkillIds,
            status: "qualified",
          },
        }),
        { mode: 0o600 },
      );
      const flagsOnly = run(
        lisaSafe,
        ["sheets-read", "--spreadsheet", "sheet_1", "--range", "Summary!A1"],
        fixture,
      );
      assert.equal(flagsOnly.status, 64);
      assert.match(flagsOnly.stderr, /qualified Skills receipt prerequisite is unavailable/);
      assert.equal(flagsOnly.stdout, "");
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  it("denies external email before invoking gws", () => {
    const fixture = makeFixture();
    const body = path.join(fixture.workRoot, "body.txt");
    writeFileSync(body, "synthetic body\n", { mode: 0o600 });
    try {
      const result = run(
        lisaSafe,
        ["email-send", "--to", "outside@example.com", "--subject", "Denied", "--body-file", body],
        fixture,
      );
      assert.equal(result.status, 64);
      assert.match(result.stderr, /external or malformed/);
      assert.equal(result.stdout, "", "gws must not be invoked");
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  it("keeps Carlos Tasks on a separate config directory", () => {
    const fixture = makeFixture();
    try {
      const result = run(tasks, ["tasks", "list", "--tasklist", "carlos_list"], fixture);
      assert.equal(result.status, 0, result.stderr);
      const captured = result.stdout;
      assert.match(captured, new RegExp(`${fixture.configRoot}/carlos-tasks`));
      assert.match(captured, /tasks\ntasks\nlist/);
      assert.doesNotMatch(captured, new RegExp(`${fixture.configRoot}/lisa`));
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  it("exposes bounded Gmail and Drive/Docs read verbs", () => {
    const fixture = makeFixture();
    try {
      const search = run(lisaSafe, ["gmail-search", "--query", "is:unread", "--max", "3"], fixture);
      assert.equal(search.status, 0, search.stderr);
      assert.match(search.stdout, /gmail\nusers\nmessages\nlist/);
      assert.match(search.stdout, /"maxResults":3/);

      const message = run(lisaSafe, ["gmail-read", "--message-id", "message_1"], fixture);
      assert.equal(message.status, 0, message.stderr);
      assert.match(message.stdout, /gmail\nusers\nmessages\nget/);

      const drive = run(
        lisaSafe,
        ["drive-read", "--file-id", "file_1", "--output-file", "file.bin"],
        fixture,
      );
      assert.equal(drive.status, 0, drive.stderr);
      assert.match(drive.stdout, /drive\nfiles\nget/);
      const outputPath = path.join(realpathSync(fixture.workRoot), "downloads", "file.bin");
      assert.match(drive.stdout, new RegExp(`--output\\n${outputPath}`));
      assert.equal(readFileSync(outputPath, "utf8"), "synthetic-download");
      assert.equal((statSync(outputPath).mode & 0o777).toString(8), "600");

      const docs = run(lisaSafe, ["docs-read", "--document", "document_1"], fixture);
      assert.equal(docs.status, 0, docs.stderr);
      assert.match(docs.stdout, /docs\ndocuments\nget/);
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  it("exposes bounded Sheets values and Slides presentation verbs", () => {
    const fixture = makeFixture();
    try {
      const sheetRead = run(
        lisaSafe,
        ["sheets-read", "--spreadsheet", "sheet_1", "--range", "Summary!A1:D10"],
        fixture,
      );
      assert.equal(sheetRead.status, 0, sheetRead.stderr);
      assert.match(sheetRead.stdout, /sheets\n\+read/);
      assert.match(sheetRead.stdout, /--range\nSummary!A1:D10/);

      const sheetAppend = run(
        lisaSafe,
        [
          "sheets-append",
          "--spreadsheet",
          "sheet_1",
          "--range",
          "Summary",
          "--json-values",
          '[["status",true],["count",2]]',
          "--dry-run",
        ],
        fixture,
      );
      assert.equal(sheetAppend.status, 0, sheetAppend.stderr);
      assert.match(sheetAppend.stdout, /sheets\n\+append/);
      assert.match(sheetAppend.stdout, /--json-values\n\[\[\"status\",true\],\[\"count\",2\]\]/);

      const sheetCreate = run(
        lisaSafe,
        ["sheets-create", "--title", "Synthetic workbook", "--dry-run"],
        fixture,
      );
      assert.equal(sheetCreate.status, 0, sheetCreate.stderr);
      assert.match(sheetCreate.stdout, /sheets\nspreadsheets\ncreate/);
      assert.match(sheetCreate.stdout, /--json\n\{"properties":\{"title":"Synthetic workbook"\}\}/);

      const badValues = run(
        lisaSafe,
        [
          "sheets-append",
          "--spreadsheet",
          "sheet_1",
          "--range",
          "Summary",
          "--json-values",
          '{"not":"rows"}',
        ],
        fixture,
      );
      assert.equal(badValues.status, 64);
      assert.equal(badValues.stdout, "");

      const slideRead = run(lisaSafe, ["slides-read", "--presentation", "presentation_1"], fixture);
      assert.equal(slideRead.status, 0, slideRead.stderr);
      assert.match(slideRead.stdout, /slides\npresentations\nget/);

      const slideCreate = run(
        lisaSafe,
        ["slides-create", "--title", "Synthetic review", "--dry-run"],
        fixture,
      );
      assert.equal(slideCreate.status, 0, slideCreate.stderr);
      assert.match(slideCreate.stdout, /slides\npresentations\ncreate/);
      assert.match(slideCreate.stdout, /--json\n\{\"title\":\"Synthetic review\"\}/);
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  it("builds bounded Carlos Task write bodies without exposing a generic method", () => {
    const fixture = makeFixture();
    try {
      const inserted = run(
        tasks,
        [
          "tasks",
          "insert",
          "--tasklist",
          "carlos_list",
          "--title",
          "Synthetic task",
          "--notes",
          "No live task was created",
          "--dry-run",
        ],
        fixture,
      );
      assert.equal(inserted.status, 0, inserted.stderr);
      const insertArgs = inserted.stdout.split("\n");
      const insertJson = insertArgs[insertArgs.indexOf("--json") + 1];
      assert.deepEqual(JSON.parse(insertJson ?? ""), {
        title: "Synthetic task",
        notes: "No live task was created",
      });

      const patched = run(
        tasks,
        [
          "tasks",
          "patch",
          "--tasklist",
          "carlos_list",
          "--task",
          "task_1",
          "--status",
          "completed",
          "--dry-run",
        ],
        fixture,
      );
      assert.equal(patched.status, 0, patched.stderr);
      const patchArgs = patched.stdout.split("\n");
      const patchJson = patchArgs[patchArgs.indexOf("--json") + 1];
      assert.deepEqual(JSON.parse(patchJson ?? ""), { status: "completed" });
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  it("rejects arbitrary commands and credentials outside the identity directory", () => {
    const fixture = makeFixture();
    try {
      const unknown = run(lisaSafe, ["gws-help", "drive"], fixture);
      assert.equal(unknown.status, 64);

      const outside = path.join(fixture.directory, "outside-credentials.json");
      writeFileSync(outside, "synthetic", { mode: 0o600 });
      const externalCredential = run(lisaSafe, ["drive-list"], fixture, {
        GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE: outside,
      });
      assert.equal(externalCredential.status, 64);
      assert.match(externalCredential.stderr, /inherited auth\/config environment/);
      assert.equal(externalCredential.stdout, "", "gws must not be invoked");
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  it("rejects inherited auth sources and hostile dotenv before gws starts", () => {
    const fixture = makeFixture();
    try {
      for (const name of [
        "GOOGLE_WORKSPACE_CLI_TOKEN",
        "GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE",
        "GOOGLE_APPLICATION_CREDENTIALS",
        "GOOGLE_WORKSPACE_CLI_CLIENT_ID",
        "GOOGLE_WORKSPACE_CLI_CLIENT_SECRET",
        "GOOGLE_WORKSPACE_PROJECT_ID",
        "GOOGLE_CLOUD_PROJECT",
        "GOOGLE_CLOUD_QUOTA_PROJECT",
        "GOOGLE_WORKSPACE_CLI_CONFIG_DIR",
        "GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND",
        "CLOUDSDK_CONFIG",
        "XDG_CONFIG_HOME",
      ]) {
        const result = run(lisaSafe, ["drive-list"], fixture, { [name]: "injected" });
        assert.equal(result.status, 64, `${name} must fail closed`);
        assert.equal(result.stdout, "", `${name} must not reach gws`);
      }
      writeFileSync(path.join(fixture.directory, ".env"), "GOOGLE_WORKSPACE_CLI_TOKEN=$HOSTILE\n", {
        mode: 0o600,
      });
      const dotenv = run(lisaSafe, ["drive-list"], fixture);
      assert.equal(dotenv.status, 64);
      assert.match(dotenv.stderr, /\.env file in execution cwd ancestry/);
      assert.equal(dotenv.stdout, "");
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  it("rejects direct and ancestor symlink escapes before reading work or config files", () => {
    const fixture = makeFixture();
    try {
      const outside = path.join(fixture.directory, "outside.txt");
      writeFileSync(outside, "synthetic outside content\n", { mode: 0o600 });
      symlinkSync(outside, path.join(fixture.workRoot, "linked.txt"));
      const direct = run(
        lisaSafe,
        ["docs-append", "--document", "doc_1", "--text-file", "linked.txt"],
        fixture,
      );
      assert.equal(direct.status, 64);
      assert.match(direct.stderr, /symlink path component/);
      assert.equal(direct.stdout, "");

      const outsideDir = path.join(fixture.directory, "outside-dir");
      mkdirSync(outsideDir, { mode: 0o700 });
      writeFileSync(path.join(outsideDir, "nested.txt"), "synthetic outside content\n", {
        mode: 0o600,
      });
      symlinkSync(outsideDir, path.join(fixture.workRoot, "linked-dir"));
      const ancestor = run(
        lisaSafe,
        ["docs-append", "--document", "doc_1", "--text-file", "linked-dir/nested.txt"],
        fixture,
      );
      assert.equal(ancestor.status, 64);
      assert.match(ancestor.stderr, /symlink path component/);
      assert.equal(ancestor.stdout, "");

      const linkedRoot = path.join(fixture.directory, "linked-config");
      symlinkSync(fixture.configRoot, linkedRoot);
      const linkedConfig = run(lisaSafe, ["drive-list"], fixture, {
        LISA_GOOGLE_WORKSPACE_CONFIG_ROOT: linkedRoot,
      });
      assert.equal(linkedConfig.status, 64);
      assert.match(linkedConfig.stderr, /non-symlink directory/);
      assert.equal(linkedConfig.stdout, "");
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  it("keeps Drive binary outputs private, contained, and no-overwrite", () => {
    const fixture = makeFixture();
    try {
      const traversal = run(
        lisaSafe,
        ["drive-read", "--file-id", "file_1", "--output-file", "../escape.bin"],
        fixture,
      );
      assert.equal(traversal.status, 64);
      assert.equal(traversal.stdout, "");

      const outside = path.join(fixture.directory, "outside-downloads");
      mkdirSync(outside, { mode: 0o700 });
      rmSync(path.join(fixture.workRoot, "downloads"), { recursive: true, force: true });
      symlinkSync(outside, path.join(fixture.workRoot, "downloads"));
      const symlink = run(
        lisaSafe,
        ["drive-read", "--file-id", "file_1", "--output-file", "escape.bin"],
        fixture,
      );
      assert.equal(symlink.status, 64);
      assert.equal(symlink.stdout, "");

      rmSync(path.join(fixture.workRoot, "downloads"), { force: true });
      mkdirSync(path.join(fixture.workRoot, "downloads"), { mode: 0o700 });
      writeFileSync(path.join(fixture.workRoot, "downloads", "existing.bin"), "preserve", {
        mode: 0o600,
      });
      const overwrite = run(
        lisaSafe,
        ["drive-read", "--file-id", "file_1", "--output-file", "existing.bin"],
        fixture,
      );
      assert.equal(overwrite.status, 64);
      assert.equal(overwrite.stdout, "");
      assert.equal(
        readFileSync(path.join(fixture.workRoot, "downloads", "existing.bin"), "utf8"),
        "preserve",
      );
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  it("requires encrypted file-backend material and rejects plaintext steady-state credentials", () => {
    const fixture = makeFixture();
    try {
      writeFileSync(path.join(fixture.configRoot, "lisa", "credentials.json"), "synthetic", {
        mode: 0o600,
      });
      const plaintext = run(lisaSafe, ["drive-list"], fixture);
      assert.equal(plaintext.status, 64);
      assert.match(plaintext.stderr, /plaintext credentials\.json/);
      assert.equal(plaintext.stdout, "");
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  it("accepts a fresh encrypted login with no cache and validates optional encrypted caches", () => {
    const fixture = makeFixture();
    try {
      const fresh = run(lisaSafe, ["drive-list"], fixture);
      assert.equal(fresh.status, 0, fresh.stderr);
      writeFileSync(path.join(fixture.configRoot, "lisa", "token_cache.json"), "synthetic-cache", {
        mode: 0o600,
      });
      const cached = run(lisaSafe, ["drive-list"], fixture);
      assert.equal(cached.status, 0, cached.stderr);
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  it("rejects retained OAuth client configuration after encrypted login", () => {
    const fixture = makeFixture();
    try {
      writeFileSync(path.join(fixture.configRoot, "lisa", "client_secret.json"), "synthetic", {
        mode: 0o600,
      });
      const result = run(lisaSafe, ["drive-list"], fixture);
      assert.equal(result.status, 64);
      assert.match(result.stderr, /client_secret\.json must be removed/);
      assert.equal(result.stdout, "");
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  it("uses the fixed trusted preflight PATH despite a hostile caller PATH", () => {
    const fixture = makeFixture();
    try {
      const shimDir = path.join(fixture.directory, "hostile-bin");
      const marker = path.join(fixture.directory, "hostile-path-ran");
      mkdirSync(shimDir, { mode: 0o700 });
      for (const command of ["dirname", "realpath", "stat"]) {
        const shim = path.join(shimDir, command);
        writeFileSync(shim, `#!/bin/sh\nprintf hostile > ${JSON.stringify(marker)}\nexit 97\n`, {
          mode: 0o700,
        });
        chmodSync(shim, 0o700);
      }
      const result = run(lisaSafe, ["drive-list"], fixture, { PATH: shimDir });
      assert.equal(result.status, 0, result.stderr);
      assert.throws(() => readFileSync(marker, "utf8"), /ENOENT/u);
      for (const file of [lisaSafe, tasks, path.join(root, "gws-wrapper-common.sh")]) {
        assert.match(readFileSync(file, "utf8"), /PATH=\/usr\/local\/bin:\/usr\/bin:\/bin/);
      }
      assert.match(readFileSync(installer, "utf8"), /default: \/usr\/local\/bin/);
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  it("pins the official release and records both approved Linux digests", () => {
    const pin = JSON.parse(readFileSync(path.join(root, "gws-linux-pin.json"), "utf8")) as {
      release: string;
      releaseCommit: string;
      artifacts: Record<string, { sha256: string }>;
    };
    const installerText = readFileSync(installer, "utf8");
    assert.equal(pin.release, "v0.22.5");
    assert.equal(pin.releaseCommit, "705fb0ecac6f4249679958f6325b809b63fdde17");
    assert.match(pin.artifacts["x86_64-unknown-linux-gnu"]?.sha256 ?? "", /^[a-f0-9]{64}$/);
    assert.match(pin.artifacts["aarch64-unknown-linux-gnu"]?.sha256 ?? "", /^[a-f0-9]{64}$/);
    assert.match(installerText, /GWS_REQUIRE_ATTESTATION/);
    assert.doesNotMatch(installerText, /curl[^\n]*\|/);
    assert.doesNotMatch(readFileSync(lisaSafe, "utf8"), /opt\/homebrew|brew/);
    assert.doesNotMatch(readFileSync(tasks, "utf8"), /opt\/homebrew|brew/);
    const installerHelp = spawnSync(installer, ["--help"], { encoding: "utf8" });
    assert.equal(installerHelp.status, 0, installerHelp.stderr);
  });

  it("records exact least-privilege scope URLs and an explicit Local capability disposition", () => {
    const receipt = JSON.parse(
      readFileSync(path.join(root, "receipts/identity-scope.receipt.json"), "utf8"),
    ) as {
      identities: Array<{
        id: string;
        requestedScopeUrls: string[];
        mandatoryUpstreamIdentityScopeUrls: string[];
        effectiveExpectedScopeUrls: string[];
        grantedScopeVerification: string;
        scopeAllowlistDigest: string;
        prohibitedScopeUrls: string[];
      }>;
    };
    const capability = JSON.parse(
      readFileSync(path.join(root, "receipts/local-capability-disposition.json"), "utf8"),
    ) as { operations: Array<{ localOperation: string; disposition: string }> };
    assert.equal(receipt.identities.length, 2);
    for (const identity of receipt.identities) {
      assert.ok(identity.requestedScopeUrls.length > 0);
      assert.deepEqual(identity.effectiveExpectedScopeUrls, [
        ...identity.mandatoryUpstreamIdentityScopeUrls,
        ...identity.requestedScopeUrls,
      ]);
      assert.ok(
        identity.requestedScopeUrls.every((scope) =>
          scope.startsWith("https://www.googleapis.com/auth/"),
        ),
      );
      assert.match(identity.grantedScopeVerification, /equal effectiveExpectedScopeUrls/u);
      const scopeDigestInput = JSON.stringify({
        id: identity.id,
        effectiveExpectedScopeUrls: identity.effectiveExpectedScopeUrls,
        prohibitedScopeUrls: identity.prohibitedScopeUrls,
      });
      assert.equal(
        identity.scopeAllowlistDigest,
        `sha256:${createHash("sha256").update(scopeDigestInput).digest("hex")}`,
      );
      assert.ok(
        identity.prohibitedScopeUrls.every(
          (scope) => !identity.effectiveExpectedScopeUrls.includes(scope),
        ),
      );
    }
    assert.equal(
      capability.operations.find((item) => item.localOperation === "drive-json")?.disposition,
      "omit-unsafe",
    );
    assert.equal(
      capability.operations.find((item) => item.localOperation === "gmail-search-and-message-read")
        ?.disposition,
      "migrate",
    );
    const bindings = JSON.parse(
      readFileSync(path.join(root, "receipts/workspace-bindings.receipt.json"), "utf8"),
    ) as {
      status: string;
      identityBindings: Record<string, string>;
      calendarBindings: Record<string, string>;
      calendarAllowlist: Array<{ bindingRef: string; access: string; includeInDigest: boolean }>;
      excludedCalendars: Array<{ bindingRef: string; reason: string }>;
      calendarAllowlistDigest: string;
      negativeAccessAssertions: Array<{ case: string; expected: string }>;
      privacy: { accountIdentifiers: string; calendarResourceIds: string };
    };
    assert.equal(bindings.status, "source-contract-only");
    assert.deepEqual(bindings.identityBindings, {
      lisaAccountRef: "opaque_lisa-workspace_account",
      carlosTasksIdentityRef: "opaque_carlos-tasks_account",
    });
    assert.deepEqual(bindings.calendarBindings, {
      workCalendarRef: "opaque_lisa-workspace_calendar_work",
      routineCalendarRef: "opaque_lisa-workspace_calendar_routine",
      sharedPersonalEventsCalendarRef: "opaque_lisa-workspace_calendar_shared-personal-events",
    });
    assert.ok(
      bindings.calendarAllowlist.every(
        (binding) => binding.bindingRef.startsWith("opaque_") && binding.includeInDigest,
      ),
    );
    assert.equal(
      bindings.excludedCalendars[0]?.bindingRef,
      "opaque_lisa-workspace_calendar_routine",
    );
    assert.equal(
      bindings.calendarAllowlistDigest,
      `sha256:${createHash("sha256").update(JSON.stringify(bindings.calendarAllowlist)).digest("hex")}`,
    );
    assert.deepEqual(
      bindings.negativeAccessAssertions.map((assertion) => assertion.expected),
      ["denied", "denied", "denied", "denied", "denied"],
    );
    assert.equal(bindings.privacy.accountIdentifiers, "not recorded");
    assert.equal(bindings.privacy.calendarResourceIds, "not recorded");
    const qualifiedSkills = JSON.parse(
      readFileSync(path.join(root, "receipts/qualified-skills.receipt.json"), "utf8"),
    ) as {
      status: string;
      provider: { commit: string; tree: string; releaseIdentity: string; skillSetDigest: string };
      catalogueBinding: {
        path: string;
        sha256: string;
        requiredServices: string[];
        status: string;
        providerRuntime: string;
      };
      catalogueIndexBinding: {
        path: string;
        catalogueGitSha: string;
        sourceTreeSha256: string;
        sha256: string;
        requiredSkillIds: string[];
        presentSkillIds: string[];
        status: string;
      };
      qualification: {
        state: string;
        reason: string;
        executionGate: string;
        exactReleaseRequired: boolean;
        catalogueDigestRequired: boolean;
      };
      retrieval: { mode: string; copiedSkillBodies: boolean; providerRuntime: string };
      skills: Array<{ id: string; source: string; sha256: string }>;
      unsupportedByDesign: string[];
      privacy: { liveGoogleCallsPerformed: boolean };
    };
    assert.equal(qualifiedSkills.status, "qualification-required");
    assert.equal(qualifiedSkills.provider.commit, "2896fd89726f0b20258ec5a7bba55ccc6299ceb6");
    assert.equal(qualifiedSkills.provider.tree, "727694a95c83678bd6c7be7da2c5b26127b49e6e");
    assert.equal(
      qualifiedSkills.provider.releaseIdentity,
      "LiNKskills@2896fd89726f0b20258ec5a7bba55ccc6299ceb6",
    );
    assert.match(qualifiedSkills.provider.skillSetDigest, /^sha256:[a-f0-9]{64}$/u);
    assert.equal(qualifiedSkills.catalogueBinding.path, "tools/gws/interface.json");
    assert.match(qualifiedSkills.catalogueBinding.sha256, /^sha256:[a-f0-9]{64}$/u);
    assert.deepEqual(qualifiedSkills.catalogueBinding.requiredServices, [
      "docs",
      "sheets",
      "slides",
    ]);
    assert.equal(qualifiedSkills.catalogueBinding.status, "source-catalogue-bound");
    assert.equal(qualifiedSkills.catalogueBinding.providerRuntime, "not executed by OpenClaw");
    assert.equal(qualifiedSkills.catalogueIndexBinding.path, "catalog/index.json");
    assert.match(qualifiedSkills.catalogueIndexBinding.catalogueGitSha, /^[a-f0-9]{40}$/u);
    assert.match(qualifiedSkills.catalogueIndexBinding.sourceTreeSha256, /^[a-f0-9]{64}$/u);
    assert.match(qualifiedSkills.catalogueIndexBinding.sha256, /^sha256:[a-f0-9]{64}$/u);
    assert.deepEqual(qualifiedSkills.catalogueIndexBinding.requiredSkillIds, [
      "gws-shared",
      "gws-docs",
      "gws-docs-write",
      "gws-sheets",
      "gws-sheets-read",
      "gws-sheets-append",
      "gws-slides",
    ]);
    assert.deepEqual(qualifiedSkills.catalogueIndexBinding.presentSkillIds, []);
    assert.equal(
      qualifiedSkills.catalogueIndexBinding.status,
      "required-entries-absent; qualification-unavailable",
    );
    assert.equal(qualifiedSkills.qualification.state, "unavailable");
    assert.match(qualifiedSkills.qualification.reason, /exact qualified Skills release/);
    assert.equal(
      qualifiedSkills.qualification.executionGate,
      "fail-closed; no provider skill activation",
    );
    assert.equal(qualifiedSkills.qualification.exactReleaseRequired, true);
    assert.equal(qualifiedSkills.qualification.catalogueDigestRequired, true);
    assert.equal(qualifiedSkills.retrieval.mode, "exact-release-and-digest");
    assert.equal(qualifiedSkills.retrieval.copiedSkillBodies, false);
    assert.equal(qualifiedSkills.retrieval.providerRuntime, "not executed by OpenClaw");
    assert.deepEqual(
      qualifiedSkills.skills.map((skill) => skill.id),
      [
        "gws-shared",
        "gws-docs",
        "gws-docs-write",
        "gws-sheets",
        "gws-sheets-read",
        "gws-sheets-append",
        "gws-slides",
      ],
    );
    assert.ok(
      qualifiedSkills.skills.every((skill) => /^tools\/gws\/.+SKILL\.md$/u.test(skill.source)),
    );
    assert.ok(qualifiedSkills.skills.every((skill) => /^[a-f0-9]{64}$/u.test(skill.sha256)));
    assert.ok(qualifiedSkills.unsupportedByDesign.includes("raw Sheets batchUpdate"));
    assert.ok(qualifiedSkills.unsupportedByDesign.includes("raw Slides batchUpdate"));
    assert.equal(qualifiedSkills.privacy.liveGoogleCallsPerformed, false);
    const adapter = JSON.parse(
      readFileSync(path.join(root, "receipts/host-adapter-contract.json"), "utf8"),
    ) as {
      trustedPath: string;
      forbiddenInvocationForms: string[];
      fixedEnvironmentKeys: string[];
      sourceRelativeEntrypoints: string[];
      deployedAbsoluteEntrypoints: { status: string };
    };
    assert.equal(adapter.trustedPath, "/usr/local/bin:/usr/bin:/bin");
    assert.ok(adapter.forbiddenInvocationForms.includes("env-prefix"));
    assert.ok(adapter.fixedEnvironmentKeys.includes("LISA_GWS_BIN"));
    assert.ok(
      adapter.sourceRelativeEntrypoints.every((entrypoint) => entrypoint.startsWith("linkbots/")),
    );
    assert.equal(adapter.deployedAbsoluteEntrypoints.status, "hold");
    const realCliProof = JSON.parse(
      readFileSync(path.join(root, "receipts/real-cli-secretless-proof.json"), "utf8"),
    ) as {
      status: string;
      trust: { prohibitedWorkaround: string };
      reproducer: { script: string };
      targetArtifact: { filename: string; sha256: string };
      disposableEnvironment: { image: string; imageDigest: string; platform: string };
      acceptedCommands: Array<{ command: string; exitStatus: number }>;
      summary: { commandCount: number; successfulExitCount: number; failedExitCount: number };
    };
    assert.equal(realCliProof.status, "passed-source-only");
    assert.match(realCliProof.trust.prohibitedWorkaround, /no TLS verification bypass/u);
    assert.ok(
      readFileSync(realCliProof.reproducer.script, "utf8").includes("GWS_REAL_CLI_ARCHIVE"),
    );
    assert.ok((statSync(realCliProof.reproducer.script).mode & 0o111) !== 0);
    const pin = JSON.parse(readFileSync(path.join(root, "gws-linux-pin.json"), "utf8")) as {
      artifacts: Record<string, { url: string; sha256: string }>;
    };
    const pinnedArtifact = pin.artifacts["aarch64-unknown-linux-gnu"];
    assert.equal(realCliProof.targetArtifact.filename, path.basename(pinnedArtifact.url));
    assert.equal(realCliProof.targetArtifact.sha256, pinnedArtifact.sha256);
    assert.equal(realCliProof.disposableEnvironment.image, "node:22-bookworm-slim");
    assert.match(realCliProof.disposableEnvironment.imageDigest, /^node@sha256:[a-f0-9]{64}$/);
    assert.equal(realCliProof.disposableEnvironment.platform, "linux/arm64");
    const emittedRoutes = new Set(
      [lisaSafe, tasks]
        .flatMap((entrypoint) =>
          Array.from(readFileSync(entrypoint, "utf8").matchAll(/gws_exec_route "([^"]+)"/g)),
        )
        .map((match) => match[1]),
    );
    assert.deepEqual(
      realCliProof.acceptedCommands
        .map((item) => item.command.replace(/ --help$/, ""))
        .toSorted((left, right) => left.localeCompare(right)),
      [...emittedRoutes].toSorted((left, right) => left.localeCompare(right)),
    );
    assert.equal(realCliProof.summary.commandCount, emittedRoutes.size);
    assert.equal(realCliProof.summary.successfulExitCount, emittedRoutes.size);
    assert.equal(realCliProof.summary.failedExitCount, 0);
    assert.ok(realCliProof.acceptedCommands.every((item) => item.exitStatus === 0));

    const preVpsReadiness = JSON.parse(
      readFileSync(path.join(root, "receipts/pkt-07-pre-vps-readiness.receipt.json"), "utf8"),
    ) as {
      status: string;
      consumer: { ownedPath: string };
      inertSkillsConsumption: {
        mode: string;
        copiedSkillBodies: boolean;
        providerRuntime: string;
        upstreamScanPerformed: boolean;
        liveAuditPerformed: boolean;
        sourceReceipt: string;
      };
      openclawOwnedProof: {
        canonicalFocusedTest: { command: string };
        offlineFocusedTests: { passed: number; failed: number };
        shellSyntax: { passed: number; failed: number };
        oauthPerformed: boolean;
        liveGoogleCallsPerformed: boolean;
        vpsTouched: boolean;
        productionTouched: boolean;
      };
      qualification: { required: boolean; state: string; executionGate: string };
      providerObservations?: unknown;
    };
    const inertCatalog = consumeInertQualifiedSkills(qualifiedSkills);
    assert.deepEqual(inertCatalog, {
      ok: true,
      mode: "inert-source-catalog",
      skillIds: qualifiedSkills.skills.map((skill) => skill.id),
      executionEnabled: false,
      copiedSkillBodies: false,
      providerRuntime: "not executed by OpenClaw",
    });
    assert.equal(
      readdirSync(root, { recursive: true }).filter((entry) =>
        String(entry).endsWith("SKILL.md"),
      ).length,
      0,
    );
    assert.match(
      readFileSync(path.join(root, "gws-wrapper-common.sh"), "utf8"),
      /qualification-receipt\.mjs/,
    );
    assert.doesNotMatch(
      readFileSync(path.join(root, "gws-wrapper-common.sh"), "utf8"),
      /receipt\.status === "qualified"/,
    );
    assert.equal(preVpsReadiness.status, "source-only-fail-closed");
    assert.equal(preVpsReadiness.consumer.ownedPath, "linkbots/lisa/ops/google-workspace");
    assert.equal(preVpsReadiness.inertSkillsConsumption.mode, "exact-release-and-digest");
    assert.equal(preVpsReadiness.inertSkillsConsumption.copiedSkillBodies, false);
    assert.equal(preVpsReadiness.inertSkillsConsumption.providerRuntime, "not executed by OpenClaw");
    assert.equal(preVpsReadiness.inertSkillsConsumption.upstreamScanPerformed, false);
    assert.equal(preVpsReadiness.inertSkillsConsumption.liveAuditPerformed, false);
    assert.equal(
      preVpsReadiness.inertSkillsConsumption.sourceReceipt,
      "receipts/qualified-skills.receipt.json",
    );
    assert.equal(preVpsReadiness.providerObservations, undefined);
    assert.equal(
      preVpsReadiness.openclawOwnedProof.canonicalFocusedTest.command,
      "node scripts/run-vitest.mjs linkbots/lisa/ops/google-workspace/google-workspace.test.ts",
    );
    assert.equal(preVpsReadiness.openclawOwnedProof.offlineFocusedTests.passed, 19);
    assert.equal(preVpsReadiness.openclawOwnedProof.offlineFocusedTests.failed, 0);
    assert.equal(preVpsReadiness.openclawOwnedProof.shellSyntax.passed, 5);
    assert.equal(preVpsReadiness.openclawOwnedProof.shellSyntax.failed, 0);
    assert.equal(preVpsReadiness.openclawOwnedProof.oauthPerformed, false);
    assert.equal(preVpsReadiness.openclawOwnedProof.liveGoogleCallsPerformed, false);
    assert.equal(preVpsReadiness.openclawOwnedProof.vpsTouched, false);
    assert.equal(preVpsReadiness.openclawOwnedProof.productionTouched, false);
    assert.equal(preVpsReadiness.qualification.required, true);
    assert.equal(preVpsReadiness.qualification.state, "unavailable");
    assert.match(preVpsReadiness.qualification.executionGate, /fail-closed/);
  });
});

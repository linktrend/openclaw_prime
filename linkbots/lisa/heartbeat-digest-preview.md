# Heartbeat & Morning Digest — Preview for Review

Draft previews built from Lisa's real live data (calendar, tasks, email, battery-monitor state) as of 2026-07-20 ~15:51. Edit freely — once approved, these formats (and the full instruction-file drafts for `HEARTBEAT.md` and `agents/morning-digest.md`) will be implemented.

Notes:

- Section order for both: 5.5 (Missing Calendar/Tasks), 5 (Email), 1 (Unanswered Messages), 6 (Battery Monitoring Oversight), 2 (Coding Work & Evals).
- Heartbeat = same order, condensed to topline Yes/No per section, EXCEPT Battery Monitoring which always shows full detail in both.
- Spec text said "5 lines" for the battery-monitor Status block but listed 6 items — draft kept all 6 to match what was literally specified.
- Live discrepancy caught while drafting: battery-monitor log projected an alert at 15:35 (now passed) but `activeAlertIds` is empty — worth checking once implemented.
- Unanswered Messages / Coding Work show "No" here as illustrative placeholders since live session history wasn't queryable at draft time — once implemented, Lisa computes these from real records each cycle.

---

## Morning Digest Preview (mock/populated example — busy-day scenario)

```text
Morning Digest — Monday, 20 July 2026

## A. Work

i. Summary:
Calendar events: Yes, 3 events.
Tasks: Yes, 2 open tasks.
Email: Yes, 1 email.
Unanswered Messages: Yes, one alert.

ii. Calendar Events:
1. 09:00–09:30 — Standup with LiNKtrend team — Work | Assisted calendar.
2. 14:30–15:00 — Call: Tom (Taiwan lawyer) — Work | Assisted calendar.
3. 18:00–19:00 — Dinner with Sarah — Personal | Carlos's calendar.

iii. Tasks:
1. Review Q3 contract draft from Tom — due today.
2. Send updated LiNKtrend deck to investors — due tomorrow.

iv. Email Messages:
1. From accounting@linktrend.media: Invoice #4471 needs approval before it's sent to the client. Do you approve sending as-is, or would you like changes first?
2. From Carlos (you): Reminder to book flights for the Taipei trip — already actioned, flights booked and confirmation forwarded to your inbox.

v. Unanswered Messages:
1. Telegram, 22:40 last night: you mentioned wanting to "look at the Nemotron eval numbers tomorrow" — no follow-up task was created for this yet; flagging now so it doesn't get lost. Want me to create a task for it?

## B. Coding Work & Evals: Yes

Coding Work:

i. Method: Cursor
Description: Delegated a fix for the recurring exec-approval prompts in Lisa's heartbeat checklist — replaced three ad-hoc shell commands (piped/redirected, which structurally can't get "Allow Always") with proper tool calls and one narrowly-scoped allowlist entry each.
Open Issues:
1. None — verified working with a live heartbeat run, no decision needed.

ii. Method: Local
Description: Ran a routine local-model smoke test on Qwen3.5:9b to confirm it still responds correctly after the fork cutover.
Open Issues: None.

iii. Eval Comparisons:
1. Compared DeepSeek V4 Flash vs. Nemotron 3 on a short coding task — DeepSeek completed faster with equivalent correctness. No action needed, logged for reference.

## C. Battery Monitoring

1. Expected current charge left: 67%
2. Expected time to 30%: 13:15
3. Expected time to 98%: 15:35
4. Updated Charge Rate: Charging +30 pp/h; discharging −6.5 pp/h.
5. Routine Changes: Please report if you expect any further routine changes.
- Recorded changes for today: None.
6. Please report current percentage and plugged status if you can.
7. Checks: Yes
- Alert — Projected 98%-full alert (15:35) has passed with no confirmed reading since — please confirm current % so I can reconcile the alert log.
```

---

## Heartbeat Preview

```text
Heartbeat — Monday, 20 July 2026, 15:51

## A. Work

i. Summary:
Calendar events: Yes.
Tasks: No.
Email: No.
Unanswered Messages: No.

## B. Coding Work & Evals: No

## C. Battery Monitoring

1. Expected current charge left: 67%
2. Expected time to 30%: 13:15
3. Expected time to 98%: 15:35
4. Updated Charge Rate: Charging +30 pp/h; discharging −6.5 pp/h.
5. Routine Changes: Please report if you expect any further routine changes.
- Recorded changes for today: None.
6. Please report current percentage and plugged status if you can.
7. Checks: Yes
- Alert — [short alert description] - [short action needed or taken]]
```

---

## Full section format reference (from spec)

### Unanswered Messages

```
Unanswered Messages: [No/Yes] (if yes then describe one per line below this each numbered)
```

### Coding Work & Evals

```
Coding Work & Evals: [None/Yes] (if no coding work was done at all and no evals then just say No. If there was then say Yes and then indicate below this each item)

Coding Work:
Method: [Cursor or Local]
Description: (what the coding is about, short one paragraph max plain english description of the work)
Open Issues: (items that need attention or decision, numbered so it's easy to reply)
```

### Email

```
Email Messages: [Yes/No] (if yes then each one per line each numbered short plain english description and if any action or decisions needed then ask what is needed or the action to be taken by her for approval; if the action is for Carlos to take, no reply needed, just acknowledge)
```

### Missing Calendar/Tasks

```
Summary:
Calendar Events:
Tasks:
```

(each section: one item per line, numbered; if action/decision needed, ask; if action is for Carlos, just acknowledge)

### Battery Monitoring Oversight

```
Status:
- "Expected current charge left: *%"
- "Expected time to 30%: *"
- "Expected time to 98%: *"
- "Updated Charge Rate: *"
- "Routine Changes: Please report if you expect any routine changes."
- "Please report current percentage and plugged status if you can"

Checks: (consolidates old "Files OK", "Cron jobs healthy", "No stale/one-time alerts to reconcile" — either "All OK" or reports issues)
```

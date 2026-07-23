---
type: DurableTracker
title: Battery Monitoring Events
description: Append-only reports and actions for battery safety/compliance monitoring
load: on_demand
tags: [battery-monitoring, battery, safety, compliance]
---

# Battery Monitoring Events

Use this append-only log for Carlos's reported battery percentage and plug state, selfie reminders/status, routine changes, projections, warnings, and 35% alert create/cancel notes. Never infer a reading, location, plug state, or selfie completion. Never overwrite prior events — append only (`read` full file, then `write` prior+new). When Carlos reports a reading in a dual-intent message, persist here **before** other work.

**Naming:** Battery Monitoring only (never ankle / bracelet / Ankle Monitor).
**Timezone:** Asia/Taipei (24h)
**Baseline rates until learned:** charging +30 pp/h; discharging −6.5 pp/h
**Thresholds:** display full-charge target 98%; event-driven Telegram alert at 35% (skip if plugged); plug-in escalation context 30% / 20% / 10% (no projected one-shot jobs for 45% or 98%)
**Privacy:** Telegram only; never include Battery Monitoring, battery %, plug state, selfie, restriction, or compliance details in email.

**Live files:** `/Users/linktrend/.openclaw-lisa/workspace/memory/battery-monitor.md` + `battery-monitor-state.json`
**Crons:** `lisa-morning-digest` (06:45), `lisa-heartbeat-45` (:45 every 2h except 06:45/17:45/21:45), `battery-selfie-1745`, `battery-selfie-2145`, plus event-driven `battery-monitor-alert-35` from main/`lisa-heartbeat-45` only (CLI exec from isolated heartbeat; never digest `cron.add`).

## Section C (Telegram digest + heartbeat) — concise, no commentary

```
C. Battery Monitoring
1. Expected current charge left: ~66%
2. Expected time to 30%: HH:mm or Wed HH:mm if next day; N/A if plugged/charging
3. Expected time to 98%: HH:mm or Wed HH:mm if next day; N/A if unplugged/discharging
4. Updated Charge Rate: +X pp/h charging / −Y pp/h discharging
5. Routine Changes: None | one short line
6. Please report current percentage and plugged status if you can.
7. Checks: Yes/No (+ only real alerts, short)
```

## Calculations (authoritative)

1. **Expected current charge:** From last confirmed % + plug state, project with learned (or baseline) rates to now. Display like `~66%`. Plug-only report (no %): keep last known %; switch rate by new plug state.
2. **Time to 30%:** Only when discharging/unplugged; else `N/A`. Weekday date if next day (`Wed 09:30`).
3. **Time to 98%:** Only when charging/plugged; else `N/A`. Same date rules.
4. **Updated charge rate:** Once daily at morning digest from segments (≥15m, two confirmed %) in prior 24h; average charge vs discharge separately; keep previous learned (or baseline) if no usable segment of that type.
5. **Routine changes:** Carlos chat + Google Calendar named **Routine**. Persist; show `None` or one line.
6. **35% alert:** When expected OR confirmed hits 35%; skip if plugged. Schedule only from main session / heartbeat — **never** from morning digest (breaks Telegram delivery). Digest may set `pendingAlert35` in state only.

## Events (append only)

_(Live workspace holds the append-only history. Personality mirror is the procedure template — do not duplicate live events here.)_

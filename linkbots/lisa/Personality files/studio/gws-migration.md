# Google Workspace Migration — Heads-up

_Briefed 2026-07-19. No action needed yet._

## Plan

- Migrating LiNKtrend Google Workspace from current HK-linked account → new US-based tenant (LiNKtrend LLC)
- Same domains: `linktrend.media`, `fourcventures.com` — email addresses unchanged
- **Test phase:** Build and fully test on disposable placeholder domain first (zero live risk)
- **Cutover day (TBD):** Release both real domains from old account → re-verify on new → recreate labels/filters/signatures/groups → switch mail
- Old account stays live as safety net after cutover

## Lisa Impact

- 3 automation connections tied to AIOS/n8n (project `linkbot-901208`) need re-authorization against the new account **on cutover day itself**
- Silently stops working if not re-authorized
- Carlos will flag exact date when locked

## Status

No action now. Waiting for cutover date.

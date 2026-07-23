# Nemotron eval summary — 2026-07-10

**Profile:** `openclaw --profile lisa` on Mac mini (gateway reachable)
**Baseline:** deepseek (`openrouter/deepseek/deepseek-v4-flash`)
**Experiment:** nemotron (`openrouter/nvidia/nemotron-3-super-120b-a12b:free`)

## Score comparison (1–5)

| Track     | Model    | Accuracy | Instructions | Latency | Cost |
| --------- | -------- | -------- | ------------ | ------- | ---- |
| daily-ops | deepseek | 4        | 5            | 4       | 4    |
| daily-ops | nemotron | 3        | 4            | 3       | 5    |
| coding    | deepseek | 3        | 4            | 3       | 4    |
| coding    | nemotron | 1        | 1            | 3       | 5    |

## Rate limits / failures

- Nemotron free tier: `ResourceExhausted: Worker local total request limit reached (118/32)` and `(33/32)` on failed agent runs before successful daily/coding completions.
- DeepSeek coding: one `Network connection lost` failover; retry succeeded.
- No changes to `openclaw.json` or personality files.

## Promotion rule (README)

Requires match/beat DeepSeek on **both** tracks across **≥3 runs** without rate-limit failures.

## Overall verdict

**KEEP_EVAL** — Single paired run only; nemotron **does not** match baseline on coding (refusal + wrong tool path). Daily-ops is usable but slower and slightly less accurate on scheduling/silo nuance. Continue eval; do **not** promote to menu yet.

## Log files

- `2026-07-10-daily-ops-deepseek.md`
- `2026-07-10-daily-ops-nemotron.md`
- `2026-07-10-coding-deepseek.md`
- `2026-07-10-coding-nemotron.md`
- `2026-07-10-nemotron-eval-summary.md` (this file)

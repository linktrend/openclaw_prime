# Model Evaluations

Parallel model experiments (Phase A). **Do not promote a model to daily use without logged results here.**

## Active experiment: Nemotron vs DeepSeek

**Model:** `openrouter/nvidia/nemotron-3-super-120b-a12b:free` (alias: `nemotron`)
**Baseline:** `openrouter/deepseek/deepseek-v4-flash` (alias: `deepseek`)

### Tracks

1. **Daily ops** — scheduling, project routing, Mode A/B replies, tool use
2. **Coding** — small patch, config edit, shell one-liner (Lisa-direct, not Cursor)

### Rubric (score 1–5 each)

| Criterion    | Notes                                             |
| ------------ | ------------------------------------------------- |
| Accuracy     | Factually correct, no hallucinated paths/commands |
| Instructions | Followed format, gates, silos                     |
| Latency      | Subjective: acceptable on Mac mini context        |
| Cost         | Free tier limits vs paid baseline                 |

### Log format

Create one file per run: `YYYY-MM-DD-<track>-<model>.md`

```markdown
# Eval: 2026-07-09 daily-ops nemotron

**Prompt:** (exact or summary)
**Model:** nemotron
**Baseline comparison:** deepseek (same prompt if possible)

## Scores

- Accuracy: 4
- Instructions: 5
- Latency: 3
- Cost: 5

## Notes

(what worked, what failed)

## Verdict

KEEP_EVAL | PROMOTE | REJECT
```

### Promotion rule

Promote `nemotron` to menu consideration only if it **matches or beats** DeepSeek on both tracks across ≥3 runs without rate-limit failures.

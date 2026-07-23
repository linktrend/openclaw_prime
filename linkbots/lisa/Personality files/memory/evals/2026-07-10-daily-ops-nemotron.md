# Eval: 2026-07-10 daily-ops nemotron

**Prompt:** It is 10:50 Asia/Taipei. Carlos says: "Need GCP billing reconciliation before Monday, and the Lisa Prime personality audit backlog is piling up." Reply in Mode A (USER.md): which project/silo owns each item, ping now vs wait for 14:45 review period, one next step per item. Conclusion first, plain English, no tool calls unless essential.
**Model:** nemotron (`openrouter/nvidia/nemotron-3-super-120b-a12b:free`)
**Baseline comparison:** deepseek (same prompt)
**Harness:** `openclaw --profile lisa agent --model nemotron --session-key agent:main:eval-20260710-daily-nm`
**Elapsed:** ~54s (gateway durationMs 53850)

## Scores

- Accuracy: 3
- Instructions: 4
- Latency: 3
- Cost: 5

## Notes

- Venture Operations for GCP matches baseline; Lisa Prime → General AI/Dev (rank 7) vs baseline Internal/Meta — acceptable but less precise.
- Mentioned "10:45–11:15 review window" for urgent GCP ping; USER.md lists 14:45 as review period (minor schedule confusion).
- Shorter, still Mode A-ish. Two earlier attempts hit Nvidia free-tier `ResourceExhausted: Worker local total request limit reached` before this successful run.

## Response (excerpt)

GCP → Venture Operations, ping now, export/reconcile billing. Lisa Prime audit → General AI/Dev, wait for 14:45 unless urgent.

## Verdict

KEEP_EVAL

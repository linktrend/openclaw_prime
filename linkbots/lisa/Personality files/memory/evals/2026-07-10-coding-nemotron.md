# Eval: 2026-07-10 coding nemotron

**Prompt:** Lisa-direct coding task: Provide the exact openclaw CLI one-liner using profile lisa to validate config without modifying files. Include what successful output looks like. If you know a second one-liner to print only the default model id from config, add it. No full app dev—commands only.
**Model:** nemotron (`openrouter/nvidia/nemotron-3-super-120b-a12b:free`)
**Baseline comparison:** deepseek (same prompt)
**Harness:** `openclaw --profile lisa agent --model nemotron --session-key agent:main:eval-20260710-coding-nm`
**Elapsed:** ~48s (gateway durationMs 47916)

## Scores

- Accuracy: 1
- Instructions: 1
- Latency: 3
- Cost: 5

## Notes

- Refused to answer citing "do not invent commands"; emitted `NO_REPLY`.
- Attempted `gateway action=config.get key=default_model` (failed) instead of documented CLI.
- Does not beat baseline on coding track. Prior failed attempt: same Nvidia `ResourceExhausted` rate limit (33/32).

## Response (excerpt)

Declined to provide CLI one-liners; tool error on gateway config.get.

## Verdict

REJECT

# Eval: 2026-07-10 coding deepseek

**Prompt:** Lisa-direct coding task: Provide the exact openclaw CLI one-liner using profile lisa to validate config without modifying files. Include what successful output looks like. If you know a second one-liner to print only the default model id from config, add it. No full app dev—commands only.
**Model:** deepseek (`openrouter/deepseek/deepseek-v4-flash`)
**Baseline comparison:** baseline (self)
**Harness:** `openclaw --profile lisa agent --model deepseek --session-key agent:main:eval-20260710-coding-ds2`
**Elapsed:** ~81s (gateway durationMs 80762; first attempt failed with network error)

## Scores

- Accuracy: 3
- Instructions: 4
- Latency: 3
- Cost: 4

## Notes

- `openclaw --profile lisa config validate` is correct (verified locally: `Config valid: ~/.openclaw-lisa/openclaw.json`, exit 0).
- Second one-liner wrong: `config get defaultModel` fails; correct path is `config get agents.defaults.model.primary` → `openrouter/deepseek/deepseek-v4-flash`.
- Referenced `config.yaml`; profile uses `openclaw.json`.

## Response (excerpt)

Provided `config validate` and `config get defaultModel` with example success output.

## Verdict

KEEP_EVAL

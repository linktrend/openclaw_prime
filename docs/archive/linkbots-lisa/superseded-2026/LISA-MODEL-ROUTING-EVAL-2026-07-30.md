# Lisa model routing evaluation (read-only) — 2026-07-30

**Status:** evaluation only — do **not** edit live or repo `openclaw.json` model config. **Carlos decides** final routing; this document does not.

**Sources checked:** OpenClaw `extensions/minimax/provider-models.ts` (M3 image metadata), `src/media-understanding/runner.ts` (M3 native-vision selection), `extensions/minimax/media-understanding-provider.ts` (plugin VL-01 default), `docs/concepts/model-providers.md`, OpenRouter/Z.AI/Moonshot/NVIDIA public model pages where reachable without printing credentials.

---

## Verified facts (OpenClaw source)

| Fact                                                                                                            | Evidence                                                                                    |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| MiniMax chat default id is `MiniMax-M3`                                                                         | `extensions/minimax/provider-models.ts` `MINIMAX_DEFAULT_MODEL_ID`                          |
| Catalog registers `MiniMax-M3` with `input: ["text", "image"]` (native image metadata)                          | `extensions/minimax/provider-models.ts` `MINIMAX_TEXT_MODEL_CATALOG`                        |
| `MiniMax-M2.7` / highspeed are `input: ["text"]` only                                                           | Same catalog                                                                                |
| M3 native-vision selection (skip imageModel when active chat is M3/M3.x)                                        | `src/media-understanding/runner.ts` (`isMinimaxNativeVisionModel` + vision-skip tests)      |
| Plugin default image-understanding route is **`MiniMax-VL-01`**                                                 | `extensions/minimax/media-understanding-provider.ts` `defaultModels.image: "MiniMax-VL-01"` |
| Current Lisa defaults (personality / live) use OpenRouter MiniMax M3 as primary chat; no dedicated `imageModel` | Prior eval + personality defaults on `development`                                          |
| Free Nemotron ids exist for eval — must not stay in production chain                                            | Prior registry / eval notes                                                                 |

## Unresolved facts (need live catalog / credentialed proof)

| Item                                                                                                                                            | Why unresolved                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Exact OpenRouter route `openrouter/minimax/minimax-m3` accepts image **as `agents.defaults.imageModel`** through OpenClaw capability resolution | Catalog metadata ≠ live route proof; no credentialed live call in this task |
| Z.AI vs OpenRouter latency/cost for `glm-5.2` on Mini                                                                                           | Needs live key + pricing snapshot at cutover time                           |
| Moonshot `kimi-k3` vs OpenRouter `moonshotai/kimi-k3` tool-call parity                                                                          | Needs live tool-call smoke                                                  |
| Paid Nemotron Super vs Ultra budget                                                                                                             | Product choice                                                              |
| Whether dedicated `imageModel` should be VL-01 media path vs M3 chat-vision                                                                     | Depends on Carlos’s preferred attachment path                               |

## Recommendations (not a final decision)

1. **Primary chat:** Prefer `zai/glm-5.2` if `ZAI_API_KEY` is already in GSM; else `openrouter/z-ai/glm-5.2`.
2. **`agents.defaults.imageModel`:** Prefer **`minimax/MiniMax-VL-01`** (plugin-owned media-understanding default) **or leave unset** and rely on M3 session native vision when the active chat model is MiniMax-M3.
   **Do not** set `openrouter/minimax/minimax-m3` as `imageModel` unless a live provider/catalog request **and** OpenClaw capability resolution prove that exact route accepts image input for the imageModel path.
3. **First chat fallback:** `openrouter/moonshotai/kimi-k3` (paid).
4. **Utility:** `openrouter/google/gemini-3.5-flash-lite` as dedicated utility/subagent or optional fallback slot (Carlos chooses).
5. **Eval only (paid):** `openrouter/nvidia/nemotron-3-super-120b-a12b` — **remove all free Nemotron** from any proposed final chain.
6. Keep Cursor ACP `grok-4.5[effort=high,fast=true]` unchanged.
7. Keep `ollama/qwen3.5:9b` as local-coder / last emergency fallback.

## Proposed evaluation table (not applied)

| Slot                                 | Candidate                                      | Notes                           |
| ------------------------------------ | ---------------------------------------------- | ------------------------------- |
| `agents.defaults.model.primary`      | `zai/glm-5.2` or `openrouter/z-ai/glm-5.2`     | Carlos picks transport          |
| `agents.defaults.model.fallbacks[0]` | `openrouter/moonshotai/kimi-k3`                | Paid                            |
| Utility / optional fallback          | `openrouter/google/gemini-3.5-flash-lite`      | Paid low                        |
| Last fallback                        | `ollama/qwen3.5:9b`                            | Local                           |
| `agents.defaults.imageModel.primary` | `minimax/MiniMax-VL-01` **or unset**           | Not OpenRouter M3 unless proven |
| Eval alias (paid only)               | `openrouter/nvidia/nemotron-3-super-120b-a12b` | No `:free`                      |
| Cursor                               | `grok-4.5[effort=high,fast=true]`              | Unchanged                       |

## Decisions for Carlos (stop — no config edits)

1. Z.AI direct vs OpenRouter for GLM-5.2?
2. Utility Gemini as fallback slot vs dedicated agent only?
3. Nemotron Super vs Ultra for paid eval budget?
4. Remove DeepSeek from default chain?
5. imageModel = MiniMax-VL-01, unset, or proven live M3 route?

**Stop for approval — no config edits in this task.**

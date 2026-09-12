# LISA-MODEL-ROUTING-CONTRACT — 2026-08-01

**Status:** approved non-live workshop contract (OCP-W10 freeze; OCP-W20 candidate strengthen; OCP-W30 Principal-approved MiniMax-M3 PDF/document candidate at `approved_unverified`).
**Do not** edit live `~/.openclaw-lisa/openclaw.json` from this document.
**Staged canary:** non-live by default (`liveMutationAllowed: false`).

## Code + fragment

- TypeScript: `linkbots/lisa/ops/model-routing-contract.ts`
- JSON fragment: `linkbots/lisa/ops/model-routing.contract.json`
- Contract tests: `linkbots/lisa/ops/model-routing-contract.test.ts`
- **Mac Mini stage OpenRouter-only overlay:** `linkbots/lisa/ops/model-routing.openrouter-stage.ts` + `model-routing.openrouter-stage.contract.json` + `model-routing.openrouter-stage.test.ts`
- Stage ops canary runbook: `docs/execution/openclawdevelopmentplan01/runbooks/lisa-stage-ops-canary.md`
- Prior eval notes (superseded for defaults): `LISA-MODEL-ROUTING-EVAL-2026-07-30.md`
- Release graph: `docs/evidence/ocp-w30-approved-pdf-routing/release-graph.md`

## Mac Mini stage OpenRouter-only posture

Semantic slots above remain the workshop authority. For **lisa-stage** (port 18791), runtime uses the OpenRouter-only overlay:

| Slot                      | Stage OpenRouter ref                                              |
| ------------------------- | ----------------------------------------------------------------- |
| Primary + thinking medium | `openrouter/openai/gpt-5.6-luna`                                  |
| First fallback            | `openrouter/z-ai/glm-5.2`                                         |
| Image + PDF candidate     | `openrouter/minimax/minimax-m3` (`imageModel` + stage `pdfModel`) |
| Next fallback             | `openrouter/moonshotai/kimi-k3`                                   |
| Utility                   | `openrouter/google/gemini-3.5-flash-lite`                         |
| Evaluation-only           | `openrouter/nvidia/nemotron-3-super-120b-a12b` (not in defaults)  |

**Credential rule:** OpenRouter is the only provider credential (`OPENROUTER_API_KEY` name). Do **not** request or configure direct OpenAI / Z.AI / MiniMax / Moonshot / NVIDIA / Google provider keys for stage. PDF remains `approved_unverified` until a first-production-proof receipt.

## Approved slots

1. Primary: `openai/gpt-5.6-luna`, reasoning effort **medium**
2. Default fallback: `zai/glm-5.2`
3. Image (`agents.defaults.imageModel`): `minimax/MiniMax-M3` (catalog text+image)
4. PDF / documentModels (candidate): `minimax/MiniMax-M3` — capability **`approved_unverified`**
5. Next fallback: `moonshot/kimi-k3`
6. Utility: `openrouter/google/gemini-3.5-flash-lite`
7. Evaluation-only: `nvidia/nemotron-3-super-120b-a12b` — **not** in defaults; no `:free`; no paid spend enablement

## PDF cutover (machine-readable)

| Field                            | Value                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| `pdfDocumentModelsCutover.state` | Principal-approved **candidate** (capability `approved_unverified`) — not production-proven |
| PDF / documentModels candidate   | `minimax/MiniMax-M3`                                                                        |
| Capability class                 | `approved_unverified`                                                                       |
| First proof                      | controlled production rollout (separately authorized; **not claimed done here**)            |
| Alternate paid document routing  | **forbidden**                                                                               |

**Candidate honesty:** MiniMax-M3 is the approved PDF/document **candidate** under `approved_unverified`. Do **not** claim MiniMax-M3 PDF support is proven, accepted, or live from this contract alone. Observed media PDF textExtraction historically defaulted to `MiniMax-M2.7`; that history does not block the candidate naming, and it does not constitute M3 PDF proof.

**First-production-proof receipt** is required before any success claim. Deployment, credentials/live profile sync, and final acceptance remain **separate human gates**.

## Hard stops

- `liveMutationAllowed: false`
- `paidSpendEnablementAllowed: false`
- No live profile sync from this contract alone
- Staged canary controls remain FAKE/TEMPLATE / non-live by default (see `docs/execution/openclawdevelopmentplan01/runbooks/stage-prod-canary-controls.md`)
- No paid substitute if PDF document routing fails

## Fail-closed rollback (PDF only)

On provider/PDF failure during a separately authorized rollout:

1. Disable **PDF document routing only**
2. Preserve text, image (`imageModel`), and default-fallback routes
3. Emit a non-secret failure event
4. Do **not** route documents to another paid model

Candidate git rollback: revert the OCP-W30 candidate commit; live Lisa stays untouched.

## Rollout gate

Live profile sync requires a separate human-approved rollout after this RC lands toward `development`. Controlled **first-PDF proof** occurs only during that separately authorized production rollout. Success claims require a first-production-proof receipt. Final acceptance is a further human gate after that receipt. CI/Bugbot remain deferred until explicitly run.

## PKT-04 transient non-coding routing

The source-controlled `nonCodingRouting` fragment is a non-live decision
authority for one response. Obvious requests use deterministic tags and do not
call a classifier. Only ambiguous requests may call a classifier, and it sees
at most 2,000 characters of the request with no transcript, private memory, or
credentials. Invalid or failed classification fails closed to conversation.

Named candidate slots remain native Luna High, OpenRouter Luna Medium, direct
Moonshot Kimi K2.6, and direct Google Gemini 3.1 Flash-Lite. Those IDs are
evaluation candidates only: `exactModelIdsApproved` and
`paidRouteActivationAllowed` stay `false`, and `activationState` is
`disabled_pending_founder_approval` until a separate founder approval. GLM is not
a non-coding fallback. A request-time model/reasoning override is never
persisted to Lisa's Telegram, browser, or main-session default. Provider/model
failures may advance one candidate fallback; infrastructure failures retry the
same model, and a quality fallback requires a logged quality failure. Source-only
evaluation uses deterministic fakes; it must not select or call a live
model/provider.

The MiniMax-M3 document route remains disabled because its capability is
`approved_unverified`; it is not a default fallback and requires a separate
first-production-proof receipt before any success claim. No live profile or
credential mutation is authorized by this fragment.

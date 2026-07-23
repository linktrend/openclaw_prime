# LiNKmedia — Three Programs (Planning Stage)

_Briefed 2026-07-19. Carlos is still briefing on context; no action yet._

## The Three Programs

### 1. Discovery and Research Program

- Runs independently per configured channel
- Discovers relevant topics, performs research, verifies sources/claims, classifies risks
- Produces validated **Research Packets**
- OSS being evaluated: TrendRadar, RSSHub, Huginn, GPT Researcher, Local Deep Research, DeerFlow

### 2. Content and Asset Creation Program

- Turns approved Research Packets into long-form videos (primary), then derivative assets: shorts, images, carousels, articles, captions, subtitles
- OSS being evaluated: OpenMontage, OpenShorts, Open Generative AI
- Tools: WhisperX, FFmpeg, Remotion

### 3. Distribution, Engagement, and Analytics Program

- Pulls approved assets from channel asset buckets, schedules/publishes, retrieves metrics, manages comments/replies, analyzes results, sends feedback to Programs 1 & 2
- OSS: Postiz (preferred), Socioboard (reviewed, not preferred). Direct social-platform APIs supplement.

## Architecture Concepts

- **Harness** = complete software-controlled OS around recurring work: orchestration, instructions, data feeds, durable memory, tools, guardrails, independent grading, retries, audit records, quality gates.
- **Program** = persistent business capability implemented as its own Harness.
- Hierarchy: **Program → Modules → Phases → Issues → Executions/Runs**
- **Issue** = smallest defined and verifiable unit of work.
- **Executor** = tool assigned to perform an Issue (OSS app, AI agent, model call, deterministic code, API call, webhook, or human review).
- Governance layer is independent from the executor — decides whether output passes.

## Key Design Principles

- Programs exchange controlled, machine-readable packages but remain separate (discovery, content, publication, analytics are not one uncontrolled system).
- Channel-specific configurations allow the same Programs to operate independently across multiple media channels.
- **LiNKsites** and **LiNKdeveloper** are also Programs (Harness) — same architecture applies.

## Current Status

**Planning stage.** Reviewing each Program one module at a time, then each phase and its individual issues. After plans are agreed, build specifications will be created.

## Next Steps (for Lisa)

Carlos is continuing to brief on work done and remaining. **Do not map against schedule yet** — he will ask when ready.

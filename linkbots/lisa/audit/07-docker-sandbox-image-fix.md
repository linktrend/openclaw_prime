# Docker Sandbox Image "No Such Image" — Root-Caused and Fixed (2026-07-15)

**Status: Done, verified across a full Docker Desktop restart.**

## The problem

`start-lisa.sh` checks `docker image inspect openclaw-sandbox:bookworm-slim` before starting Lisa's gateway, and fails/blocks startup if that check fails. This happened twice in one day (both times during this chat session) — `docker images` showed the image present and correctly sized, but `docker image inspect` reported "No such image."

## Root cause

Confirmed via direct inspection + GitHub research (`moby/moby#44578`, `moby/moby#51566`): Docker Desktop's newer **containerd image store** (`UseContainerdSnapshotter: true` in Lisa's Mac mini's Docker Desktop settings — confirmed present) has a known limitation resolving images that are stored as a **multi-manifest OCI index** rather than a single manifest.

The sandbox image was being built with a plain `docker build -t ... -f Dockerfile.sandbox .` — with no flags disabling BuildKit's default **provenance/SBOM attestations**. Modern Docker BuildKit attaches these by default, which wraps even a simple single-platform local build in a multi-manifest index (visible in the old build log as `exporting attestation manifest` + `exporting manifest list`, instead of a single `exporting manifest`). With the containerd image store enabled, `docker image inspect` can then intermittently fail to resolve that index to "the default platform," even though the image is genuinely present and `docker images` (which uses a different, more tolerant lookup path) lists it fine.

This is not a Lisa-specific or OpenClaw-specific bug — it's a documented Docker/containerd interaction, but it directly caused the observed symptom.

## The fix

1. Rebuilt the image with `docker build --provenance=false --sbom=false -t openclaw-sandbox:bookworm-slim -f Dockerfile.sandbox .` — confirmed the build now produces a single `exporting manifest` line, not an attestation + manifest-list pair.
2. Updated `scripts/sandbox-setup.sh` in the `openclaw_prime` repo (`development` branch, commit `94b26862b3`, pushed) to always build with these two flags, with a comment explaining why, so a future rebuild (by Carlos, by an update script, or by a future cloned agent using the same engine) doesn't regress into the same bug.
3. Made `start-lisa.sh`'s sandbox check resilient as defense-in-depth: it now falls back to checking `docker images` if `docker image inspect` fails, and — since Lisa's `agents.defaults.sandbox.mode` is currently `off` (the sandbox image isn't even in active use right now) — it warns instead of blocking startup if the image genuinely can't be found either way. It still hard-fails if sandbox mode is actually `on`/`non-main` and the image is missing, so this doesn't silently paper over a real problem when sandboxing matters.

## Verification (not just "should work")

- Rebuilt image confirmed single-manifest (no attestation/index) in the build output.
- `docker image inspect` succeeded immediately after rebuild.
- **Stress test:** fully quit Docker Desktop (`pkill -9`, confirmed zero Docker processes running), relaunched it, waited for the engine to come back up, then re-checked — `docker image inspect openclaw-sandbox:bookworm-slim` still succeeded, image ID unchanged (`356d01c4608b`). A full Docker Desktop restart is exactly the kind of event that triggered this bug before, so this is a real test of the fix, not just a lucky rebuild.
- Full Lisa stop → start → live message round-trip confirmed clean after the fix, and again after the Docker Desktop restart.

## Where the fix lives

- `openclaw_prime` repo, `scripts/sandbox-setup.sh` — committed and pushed to `origin/development`.
- `~/.openclaw-lisa/start-lisa.sh` — updated directly on the Mac mini (this file has never been version-controlled, by earlier explicit decision — see `Personality files/README.md` provenance notes). Carlos should know this specific resilience improvement lives only on this Mac and isn't backed up anywhere else.

## Not done / not needed

- Did **not** disable Docker Desktop's containerd image store globally (`UseContainerdSnapshotter`) — that would be a much bigger, machine-wide change for a problem that's now fixed at its actual source (the build flags). Only revisit this if the same symptom ever recurs on a _different_ image, which would suggest the containerd store itself is the problem rather than this one image's build configuration.

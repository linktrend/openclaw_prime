# linkbots

Version-controlled, non-secret agent-definition bundles for **OpenClaw Prime 1.0**.

- Prime operator briefing: [`docs/openclaw-prime-1.0-briefing.md`](../docs/openclaw-prime-1.0-briefing.md)
- Five-agent Server01 source contract: [`parity/README.md`](parity/README.md)
- Lisa bundle: [`lisa/README.md`](lisa/README.md)

Each agent directory is a deployment input, not a live OpenClaw state directory:

- `lisa/` is the declared source bundle for VPS Lisa. Its scope and exclusions are recorded in `lisa/PROFILE_BUNDLE_MANIFEST.json`.
- Secrets are referenced through Google Secret Manager and are never committed here.
- Session history, device pairings, SQLite state, logs, caches, dynamic memory, and runtime configuration are not Git content. They require encrypted off-VPS backup and restore procedures.
- A deployment selects only the bundle(s) intended for that host. It does not copy every agent to every VPS.

The live profile remains the runtime truth for current behavior. A deliberate, reviewed deployment materializes the non-secret bundle and resolves its secret references; it must not overwrite mutable live state wholesale.

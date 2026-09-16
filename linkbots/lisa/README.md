# Lisa agent bundle

Reviewed non-secret definition bundle for Lisa on **OpenClaw Prime 1.0**.
Fleet briefing: [`docs/openclaw-prime-1.0-briefing.md`](../../docs/openclaw-prime-1.0-briefing.md).

This directory is the version-controlled, non-secret definition bundle for Lisa. It is the reviewed source used to prepare or recover a Lisa deployment; it is not a raw copy of a live OpenClaw profile.

`PROFILE_BUNDLE_MANIFEST.json` is the authoritative deployment boundary. It records what is eligible for source control, what is excluded, and the restore process.

`PROFILE_BUNDLE_LIVE_COMPARISON_RECEIPT.json` is the immutable, metadata-only proof used by the validator for the recorded VPS parity result. It contains paths, byte counts, SHA-256 values, the source environment identifier/revision, and the one explicitly allowed line-ending normalization—never file contents or secret values. The manifest pins the receipt by SHA-256 so a stale or edited receipt fails closed.

## What belongs here

- the stable files listed under `requiredStableDefinition` in the manifest, including reviewed identity, personality, operating instructions, agent roles, skills, templates, and tool guidance;
- non-secret agent configuration and deployment manifests;
- tests and source code that support Lisa's approved behavior.

## What never belongs here

- Google Secret Manager values, OAuth material, passwords, gateway tokens, private keys, or `.env` files;
- device pairing records, session transcripts, caches, logs, SQLite databases, and other runtime state;
- raw private memory or user data copied from a live workspace.

`Personality files/` is now a curated definition tree. Every file in it must be classified by the manifest as either a required stable definition file or an intentional asset. Mutable memories, private user material, live configuration, credentials, sessions, logs, caches, and databases are deliberately absent.

## Validate the bundle

From the repository root, run:

```bash
node linkbots/lisa/validate-profile-bundle.mjs
```

The validator parses the manifest, verifies every required SHA-256, verifies the pinned comparison receipt and its normalization rules, rejects manifest-only parity assertions, rejects unclassified files and symlinks, checks required exclusion classes, performs a bounded secret-shape scan of the stable text files, and validates the intentional image assets. It is deterministic and offline after the receipt is committed; it does not contact the VPS or read live data.

## Deployment and recovery

1. Deploy the OpenClaw code at the approved revision.
2. Materialize only the manifest-listed stable definition files and deployment-required assets.
3. Resolve secrets at startup through Google Secret Manager references.
4. Restore mutable state only from an encrypted off-VPS backup, never from Git.

Git therefore restores what Lisa is and how she is instructed to operate. Google Secret Manager restores credentials. The encrypted off-VPS backup restores changing private state such as memory, sessions, databases, device pairings, and runtime history.

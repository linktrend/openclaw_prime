#!/usr/bin/env python3
"""Customization-scoped Fast/Full validation for the OpenClaw Prime fork.

LiNKtrend delivery classifies the exact Phase diff against the committed
customization boundary, scans only admitted customization paths, and never
invokes whole-tree secret scanning or upstream OpenClaw CI.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

HEX40 = re.compile(r"^[0-9a-f]{40}$")
BOUNDARY_REL = ".linktrend/openclaw-prime/customization-boundary.json"
CLASSIFIER_REL = ".linktrend/openclaw-prime/validate_customization_boundary.py"
CONSUMER_REL = ".github/linktrend-gitops-consumer.json"
SELF_WORKFLOW_NAME = "Linktrend Full Suite"
UPSTREAM_CI_NAMES = frozenset({"CI", "ci", "OpenClaw CI"})
ADMITTED_CLASSES = frozenset(
    {
        "linktrend-owned",
        "ide-managed",
        "ide-managed-overlay",
        "ide-managed-and-linktrend-owned",
        "ide-transaction-changed",
    }
)
EXCLUDED_CLASS = "untouched-upstream-excluded"
SKIPPED_KIND = "skipped_input"
# Declared cross-contract files for this gate. They are not an upstream-tree
# waiver: src/extensions/test application paths remain excluded.
FOCUSED_CONTRACT_PATHS = frozenset(
    {
        ".github/openclaw_progressive_validation.py",
        "test/openclaw_progressive_validation.py",
    }
)
HOLD_BOUNDARY = "HOLD: customization_boundary_unavailable"
HOLD_UPSTREAM = "HOLD: untouched_upstream_excluded"
HOLD_SCAN = "HOLD: customization_secret_scan_blocked"
HOLD_CONSUMER = "HOLD: consumer_ci_mapping_invalid"

Scanner = Callable[[Path, Sequence[str]], Mapping[str, Any]]


def git(root: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode:
        raise RuntimeError((result.stderr or result.stdout).strip() or "git failed")
    return result.stdout.strip()


def load_classifier(root: Path):
    path = root / CLASSIFIER_REL
    spec = spec_from_file_location("openclaw_prime_customization_boundary", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("customization_boundary")
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_manifest(root: Path) -> Mapping[str, Any]:
    path = root / BOUNDARY_REL
    if not path.is_file() or path.is_symlink():
        raise RuntimeError("customization_boundary")
    classifier = load_classifier(root)
    manifest = json.loads(path.read_text(encoding="utf-8"))
    classifier.validate_manifest(manifest, checkout=root)
    return manifest


def consumer_workflow_names(root: Path) -> dict[str, str]:
    path = root / CONSUMER_REL
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise RuntimeError("consumer_ci_mapping_invalid") from exc
    required = ("ciWorkflowName", "fastWorkflowName", "branchPolicyWorkflowName", "reviewGateCheckName")
    names = {}
    for key in required:
        value = payload.get(key)
        if not isinstance(value, str) or not value.strip():
            raise RuntimeError("consumer_ci_mapping_invalid")
        names[key] = value
    if names["ciWorkflowName"] in UPSTREAM_CI_NAMES:
        raise RuntimeError("upstream_ci_required")
    if names["fastWorkflowName"] != "Linktrend Fast Checks":
        raise RuntimeError("consumer_ci_mapping_invalid")
    if names["ciWorkflowName"] != SELF_WORKFLOW_NAME:
        raise RuntimeError("consumer_ci_mapping_invalid")
    return names


def resolve_baseline(root: Path) -> str:
    env_sha = os.environ.get("BASELINE_SHA", "")
    if HEX40.fullmatch(env_sha):
        return env_sha
    env_ref = os.environ.get("BASELINE_REF")
    if env_ref:
        return env_ref
    return "origin/development"


def changed_paths(root: Path, baseline: str, head: str) -> tuple[str, ...]:
    spec = f"{baseline}...{head}"
    output = git(root, "diff", "--name-only", "--no-renames", spec)
    return tuple(path for path in output.splitlines() if path)


def classify_changed(
    root: Path,
    paths: Sequence[str],
    manifest: Mapping[str, Any],
) -> dict[str, str]:
    classifier = load_classifier(root)
    classified: dict[str, str] = {}
    for path in paths:
        if path in FOCUSED_CONTRACT_PATHS:
            classified[path] = "focused-contract"
            continue
        classified[path] = classifier.classify(path, manifest)
    return classified


def default_scanner(root: Path, paths: Sequence[str]) -> Mapping[str, Any]:
    from scripts.gitops.secret_scan import scan_repository

    return scan_repository(root, paths=list(paths))


def scan_admitted(
    root: Path,
    paths: Sequence[str],
    scanner: Scanner | None = None,
) -> Mapping[str, Any]:
    runner = scanner or default_scanner
    admitted = list(paths)
    result = runner(root, admitted)
    if not isinstance(result, Mapping):
        raise RuntimeError("scanner-error")
    scanned = result.get("scannedPaths")
    if scanned is not None:
        extra = sorted(set(scanned) - set(admitted))
        if extra:
            raise RuntimeError("scanner_escaped_scope")
    findings = result.get("findings") or []
    if not isinstance(findings, list):
        raise RuntimeError("scanner-error")
    for row in findings:
        if not isinstance(row, Mapping):
            raise RuntimeError("scanner-error")
        kind = row.get("kind")
        path = row.get("path")
        if kind == SKIPPED_KIND:
            raise RuntimeError("new-skipped-input")
        if path not in admitted and path is not None:
            raise RuntimeError("scanner_escaped_scope")
        if kind and kind != SKIPPED_KIND:
            raise RuntimeError("new-or-changed-finding")
    if result.get("ok") is False:
        raise RuntimeError("new-or-changed-finding")
    return result


def validate_phase(
    *,
    root: Path,
    profile: str,
    baseline: str | None = None,
    head: str = "HEAD",
    scanner: Scanner | None = None,
    changed: Sequence[str] | None = None,
) -> dict[str, Any]:
    errors: list[str] = []
    hold: str | None = None
    try:
        names = consumer_workflow_names(root)
    except RuntimeError as exc:
        return {
            "ok": False,
            "errors": [str(exc)],
            "hold": HOLD_CONSUMER,
            "profile": profile,
        }
    try:
        manifest = load_manifest(root)
    except Exception:
        return {
            "ok": False,
            "errors": ["customization_boundary"],
            "hold": HOLD_BOUNDARY,
            "profile": profile,
            "consumerWorkflows": names,
        }

    baseline_ref = baseline or resolve_baseline(root)
    try:
        paths = tuple(changed) if changed is not None else changed_paths(root, baseline_ref, head)
    except Exception:
        return {
            "ok": False,
            "errors": ["phase_diff"],
            "hold": HOLD_BOUNDARY,
            "profile": profile,
            "consumerWorkflows": names,
        }

    classifications = classify_changed(root, paths, manifest)
    excluded = sorted(
        path for path, kind in classifications.items() if kind == EXCLUDED_CLASS
    )
    admitted = sorted(
        path
        for path, kind in classifications.items()
        if kind in ADMITTED_CLASSES or kind == "focused-contract"
    )
    if excluded:
        errors.append("untouched_upstream_excluded")
        hold = HOLD_UPSTREAM

    scan_result: Mapping[str, Any] = {"findings": [], "ok": True}
    if not errors:
        try:
            scan_result = scan_admitted(root, admitted, scanner)
        except RuntimeError as exc:
            errors.append(str(exc))
            hold = HOLD_SCAN

    return {
        "ok": not errors,
        "errors": errors,
        "hold": hold,
        "profile": profile,
        "baseline": baseline_ref,
        "changedPaths": list(paths),
        "classifications": classifications,
        "admittedPaths": admitted,
        "excludedPaths": excluded,
        "scannedPaths": admitted if not errors else [],
        "findings": list(scan_result.get("findings") or []),
        "consumerWorkflows": names,
        "requireOwnFullWorkflow": False,
        "aggregateCheck": SELF_WORKFLOW_NAME,
    }


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    profile = "fast"
    if "--profile" in args:
        index = args.index("--profile")
        profile = args[index + 1]
    if profile not in {"fast", "full"}:
        print("progressive_validation_profile_invalid", file=sys.stderr)
        return 2
    root = Path.cwd()
    result = validate_phase(root=root, profile=profile)
    print(json.dumps(result, sort_keys=True, indent=2))
    if not result["ok"]:
        print(result.get("hold") or "HOLD: customization_validation_failed", file=sys.stderr)
        return 1
    print(f"customization-scoped {profile}: ok admitted={len(result['admittedPaths'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

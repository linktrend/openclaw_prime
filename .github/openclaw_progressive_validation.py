#!/usr/bin/env python3
"""Customization-scoped Fast/Full validation for the OpenClaw Prime fork.

For a governed Phase, the exact normalized protected-base-to-Phase diff is the
relevant fork-customization scope. Static provenance may describe inventory, but
must never exclude a file already proven changed by that Phase identity.
Untouched upstream means files outside that exact diff; they are not enumerated,
scanned, tested, or audited.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

HEX40 = re.compile(r"^[0-9a-f]{40}$")
REPO_REL = re.compile(
    r"^(?!/|\\)(?!.*\.\.(?:/|\\|$))(?!.*:)[A-Za-z0-9._@+, \-]+(?:/[A-Za-z0-9._@+, \-]+)*$"
)
BOUNDARY_REL = ".linktrend/openclaw-prime/customization-boundary.json"
CLASSIFIER_REL = ".linktrend/openclaw-prime/validate_customization_boundary.py"
CONSUMER_REL = ".github/linktrend-gitops-consumer.json"
SECRET_SCAN_REL = "scripts/gitops/secret_scan.py"
EVIDENCE_REL = "customization-validation-evidence.json"
SELF_WORKFLOW_NAME = "Linktrend Full Suite"
UPSTREAM_CI_NAMES = frozenset({"CI", "ci", "OpenClaw CI"})
SKIPPED_KIND = "skipped_input"
BROAD_TEST_MARKERS = (
    "broad local run will start",
    "buildFullSuiteVitestRunPlans",
)
NON_VITEST_VALIDATION = {
    ".github/linktrend-delivery-mode.json": "progressive-validation-tests",
    ".github/linktrend-gitops-consumer.json": "progressive-validation-tests",
    ".github/linktrend-repository-ci-contract.json": "progressive-validation-tests",
    ".github/openclaw_progressive_validation.py": "progressive-validation-tests",
    ".github/workflows/linktrend-integrator-merge.yml": "progressive-validation-tests",
    ".github/workflows/linktrend-review-packager.yml": "progressive-validation-tests",
    ".linktrend/openclaw-prime/customization-boundary.json": "customization-boundary-validator",
    ".linktrend/openclaw-prime/resolve_customization_tests.mts": "progressive-validation-tests",
    "docs/execution/openclaw-prime-lisa/BASELINE-CI-RECEIPT.md": "phase-diff-check",
    "docs/execution/openclaw-prime-lisa/IMPLEMENTATION-ROADMAP.md": "phase-diff-check",
    "docs/execution/openclaw-prime-lisa/dispatch-authority.json": "execution-approval-tests",
    "docs/execution/openclaw-prime-lisa/dispatch-authority.schema.json": "execution-approval-tests",
    "docs/execution/openclaw-prime-lisa/linkautowork-skill-watcher.execution-manifest.json": "execution-approval-tests",
    "docs/execution/openclaw-prime-lisa/linkplatform-agent-foundation.execution-manifest.json": "execution-approval-tests",
    "docs/execution/openclaw-prime-lisa/openclaw-prime-lisa.execution-manifest.json": "execution-approval-tests",
    "docs/execution/openclaw-prime-lisa/tests/test_execution_approval_snapshot.py": "execution-approval-tests",
    "docs/execution/openclaw-prime-lisa/validate_execution_approval_snapshot.py": "execution-approval-tests",
    "test/openclaw_progressive_validation.py": "progressive-validation-tests",
    "test/packager_coordinator_phase_history.py": "phase-packager-history-tests",
    "scripts/gitops/packager_coordinator.py": "phase-packager-history-tests",
    "scripts/gitops/secret_scan.py": "progressive-validation-tests",
}
TEST_PROJECTS = (
    "node",
    "--import",
    "./scripts/tsx.mjs",
    "scripts/test-projects.mts",
)
PLANNER = (
    "node",
    "--import",
    "./scripts/tsx.mjs",
    ".linktrend/openclaw-prime/resolve_customization_tests.mts",
)
CODE_SUFFIXES = (".ts", ".mts", ".tsx", ".cts", ".js", ".mjs", ".cjs", ".jsx")
PlannerRunner = Callable[[Sequence[str]], subprocess.CompletedProcess[str]]
TestRunner = Callable[[Sequence[str]], subprocess.CompletedProcess[str]]
ValidationRunner = Callable[[Sequence[str]], subprocess.CompletedProcess[str]]
HOLD_BOUNDARY = "HOLD: customization_boundary_unavailable"
HOLD_IDENTITY = "HOLD: phase_identity_invalid"
HOLD_SCAN = "HOLD: customization_secret_scan_blocked"
HOLD_CONSUMER = "HOLD: consumer_ci_mapping_invalid"
HOLD_TESTS = "HOLD: relevant_tests_unresolved"

Scanner = Callable[[Path, Sequence[str]], Mapping[str, Any]]


class PhaseIdentityError(RuntimeError):
    """Exact Phase identity or diff failed closed."""


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


def _ensure_repo_import_path(root: Path) -> None:
    root_str = str(root.resolve())
    if root_str not in sys.path:
        sys.path.insert(0, root_str)


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


def canonical_digest(value: Any) -> str:
    return "sha256:" + hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def resolve_commit(root: Path, ref: str) -> tuple[str, str]:
    if not isinstance(ref, str) or not ref:
        raise PhaseIdentityError("phase_identity")
    commit = git(root, "rev-parse", "--verify", f"{ref}^{{commit}}")
    if not HEX40.fullmatch(commit):
        raise PhaseIdentityError("phase_identity")
    kind = git(root, "cat-file", "-t", commit)
    if kind != "commit":
        raise PhaseIdentityError("phase_identity")
    tree = git(root, "rev-parse", f"{commit}^{{tree}}")
    if not HEX40.fullmatch(tree):
        raise PhaseIdentityError("phase_identity")
    return commit, tree


def _unsafe_path(path: str) -> bool:
    if not path or path in {".", ".."} or path.endswith("/"):
        return True
    if path.startswith("/") or "\\" in path or ":" in path:
        return True
    parts = path.split("/")
    return any(part in {"", ".", "..", ".git"} for part in parts) or not REPO_REL.fullmatch(path)


def inspect_phase_diff(root: Path, baseline: str, head: str) -> dict[str, Any]:
    baseline_commit, baseline_tree = resolve_commit(root, baseline)
    head_commit, head_tree = resolve_commit(root, head)
    ancestor = subprocess.run(
        ["git", "merge-base", "--is-ancestor", baseline_commit, head_commit],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if ancestor.returncode:
        raise PhaseIdentityError("base_not_ancestor")
    rename_out = git(root, "diff", "--name-status", "--find-renames", baseline_commit, head_commit)
    for line in rename_out.splitlines():
        status = line.split("\t", 1)[0]
        if status.startswith(("R", "C")):
            raise PhaseIdentityError("unresolved_rename")
    raw = git(root, "diff", "--raw", "--no-abbrev", baseline_commit, head_commit)
    for line in raw.splitlines():
        if not line.startswith(":"):
            raise PhaseIdentityError("phase_diff")
        meta, _, path = line.partition("\t")
        parts = meta.split()
        if len(parts) < 5:
            raise PhaseIdentityError("phase_diff")
        old_mode, new_mode = parts[0][1:], parts[1]
        if old_mode == "160000" or new_mode == "160000":
            raise PhaseIdentityError("submodule")
        if new_mode == "040000" or path.endswith("/"):
            raise PhaseIdentityError("directory")
        if "\t" in path or path != path.split("\t")[-1]:
            raise PhaseIdentityError("unresolved_rename")
    status_out = git(root, "diff", "--name-status", "--no-renames", baseline_commit, head_commit)
    rows: list[dict[str, str]] = []
    existing: list[str] = []
    deleted: list[str] = []
    for line in status_out.splitlines():
        if not line:
            continue
        status, _, path = line.partition("\t")
        if status not in {"A", "M", "D", "T"} or not path or "\t" in path:
            raise PhaseIdentityError("phase_diff")
        if _unsafe_path(path):
            raise PhaseIdentityError("unsafe_path")
        rows.append({"status": status, "path": path})
        if status == "D":
            deleted.append(path)
            continue
        probe = subprocess.run(
            ["git", "cat-file", "-e", f"{head_commit}:{path}"],
            cwd=root,
            capture_output=True,
            text=True,
            check=False,
        )
        if probe.returncode:
            raise PhaseIdentityError("missing_blob")
        blob_kind = git(root, "cat-file", "-t", f"{head_commit}:{path}")
        if blob_kind != "blob":
            raise PhaseIdentityError("missing_blob")
        existing.append(path)
    rows.sort(key=lambda row: (row["path"], row["status"]))
    existing = sorted(set(existing))
    deleted = sorted(set(deleted))
    path_digests = {
        path: git(root, "rev-parse", f"{head_commit}:{path}")
        for path in existing
    }
    return {
        "baselineCommit": baseline_commit,
        "baselineTree": baseline_tree,
        "headCommit": head_commit,
        "headTree": head_tree,
        "normalizedDiff": rows,
        "normalizedDiffDigest": canonical_digest(rows),
        "existingPaths": existing,
        "deletedPaths": deleted,
        "pathDigests": path_digests,
        "untouchedUpstreamEvaluated": False,
    }


def static_classifications(
    root: Path,
    paths: Sequence[str],
    manifest: Mapping[str, Any],
) -> dict[str, str]:
    classifier = load_classifier(root)
    return {path: classifier.classify(path, manifest) for path in paths}


def load_secret_scan(root: Path):
    _ensure_repo_import_path(root)
    from scripts.gitops import secret_scan as module

    return module


def default_scanner(root: Path, paths: Sequence[str]) -> Mapping[str, Any]:
    module = load_secret_scan(root)
    return module.scan_repository(root, paths=list(paths))


def scan_existing(
    root: Path,
    paths: Sequence[str],
    scanner: Scanner | None = None,
) -> Mapping[str, Any]:
    admitted = list(paths)
    if not admitted:
        return {"ok": True, "findings": [], "scannedPaths": []}
    runner = scanner or default_scanner
    result = runner(root, admitted)
    if not isinstance(result, Mapping):
        raise RuntimeError("scanner-error")
    scanned = result.get("scannedPaths")
    if not isinstance(scanned, list) or any(not isinstance(item, str) for item in scanned):
        raise RuntimeError("scanner-error")
    admitted_set = set(admitted)
    scanned_set = set(scanned)
    extra = sorted(scanned_set - admitted_set)
    if extra:
        raise RuntimeError("scanner_escaped_scope")
    if scanned_set != admitted_set or len(scanned) != len(scanned_set):
        raise RuntimeError("scanner_incomplete_scope")
    findings = result.get("findings")
    if not isinstance(findings, list):
        raise RuntimeError("scanner-error")
    for row in findings:
        if not isinstance(row, Mapping):
            raise RuntimeError("scanner-error")
        kind = row.get("kind")
        path = row.get("path")
        if kind == SKIPPED_KIND:
            raise RuntimeError("new-skipped-input")
        if path is not None and path not in admitted:
            raise RuntimeError("scanner_escaped_scope")
        if kind and kind != SKIPPED_KIND:
            raise RuntimeError("new-or-changed-finding")
    if result.get("ok") is False:
        raise RuntimeError("new-or-changed-finding")
    payload = dict(result)
    payload["scannedPaths"] = list(scanned)
    return payload


def parse_test_list(output: str) -> list[str]:
    tests: list[str] = []
    for line in output.splitlines():
        text = line.strip().strip('"').rstrip(",")
        if not text or text.startswith("[") or text.startswith("{") or " " in text and not text.endswith(".ts"):
            if re.search(r"\.(?:test|spec)\.[cm]?[jt]sx?(?:$|\s)", text):
                match = re.search(r"((?:src|extensions|test|scripts|ui|apps)/[^\s:]+\.(?:test|spec)\.[cm]?[jt]sx?)", text)
                if match:
                    tests.append(match.group(1))
            continue
        if re.search(r"\.(?:test|spec)\.[cm]?[jt]sx?$", text) or text.endswith(".test.ts"):
            tests.append(text.split(" ", 1)[0])
    return sorted(set(tests))


def code_changes_require_tests(paths: Sequence[str]) -> bool:
    return any(path.endswith(CODE_SUFFIXES) for path in paths)


def _unsafe_target(path: str) -> bool:
    return _unsafe_path(path) or path.startswith("-") or path == "--changed"


def validate_planner_payload(
    payload: Any,
    changed_paths: Sequence[str],
    baseline_commit: str,
    head_commit: str,
    root: Path,
) -> dict[str, Any]:
    if not isinstance(payload, Mapping):
        raise RuntimeError("relevant_tests_unresolved")
    if payload.get("mode") != "targets":
        raise RuntimeError("relevant_tests_broadened")
    if (
        payload.get("schemaVersion") != 1
        or payload.get("kind") != "customization-test-target-plan"
    ):
        raise RuntimeError("relevant_tests_unresolved")
    if (
        payload.get("baselineCommit") != baseline_commit
        or payload.get("headCommit") != head_commit
    ):
        raise RuntimeError("relevant_tests_identity_mismatch")
    planned_paths = payload.get("changedPaths")
    expected_paths = sorted(set(changed_paths))
    if (
        not isinstance(planned_paths, list)
        or any(not isinstance(item, str) for item in planned_paths)
        or planned_paths != expected_paths
    ):
        raise RuntimeError("relevant_tests_identity_mismatch")
    if payload.get("changedPathsDigest") != canonical_digest(expected_paths):
        raise RuntimeError("relevant_tests_identity_mismatch")
    expected_non_vitest = [
        {"path": path, "validation": NON_VITEST_VALIDATION[path]}
        for path in expected_paths
        if path in NON_VITEST_VALIDATION
    ]
    if payload.get("nonVitestValidations") != expected_non_vitest:
        raise RuntimeError("relevant_tests_unresolved")
    skipped = payload.get("skippedBroadFallbackPaths")
    if skipped:
        raise RuntimeError("relevant_tests_broadened")
    targets = payload.get("targets")
    if not isinstance(targets, list) or any(not isinstance(item, str) for item in targets):
        raise RuntimeError("relevant_tests_unresolved")
    if any(_unsafe_target(item) for item in targets) or len(targets) != len(set(targets)):
        raise RuntimeError("relevant_tests_unresolved")
    for target in targets:
        probe = subprocess.run(
            ["git", "cat-file", "-e", f"{head_commit}:{target}"],
            cwd=root,
            capture_output=True,
            text=True,
            check=False,
        )
        if probe.returncode:
            raise RuntimeError("relevant_tests_unresolved")
    serialized = json.dumps(payload, sort_keys=True)
    if any(marker in serialized for marker in BROAD_TEST_MARKERS):
        raise RuntimeError("relevant_tests_broadened")
    if '"mode": "broad"' in serialized or '"mode":"broad"' in serialized.replace(" ", ""):
        raise RuntimeError("relevant_tests_broadened")
    all_paths_have_focused_validation = all(path in NON_VITEST_VALIDATION for path in changed_paths)
    if code_changes_require_tests(changed_paths) and not targets and not all_paths_have_focused_validation:
        raise RuntimeError("relevant_tests_unresolved")
    return dict(payload)


def invoke_planner(
    root: Path,
    baseline: str,
    head: str,
    changed_paths: Sequence[str],
    runner: PlannerRunner | None = None,
) -> dict[str, Any]:
    command = list(PLANNER) + ["--base", baseline, "--head", head]
    executed = (runner or (lambda cmd: _run_captured(cmd, root)))(command)
    stdout = executed.stdout or ""
    if executed.returncode != 0:
        combined = stdout + "\n" + (executed.stderr or "")
        if "relevant_tests_broadened" in combined or any(
            marker in combined for marker in BROAD_TEST_MARKERS
        ):
            raise RuntimeError("relevant_tests_broadened")
        raise RuntimeError("relevant_tests_unresolved")
    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError("relevant_tests_unresolved") from exc
    return validate_planner_payload(payload, changed_paths, baseline, head, root)


def _run_captured(command: Sequence[str], root: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(list(command), cwd=root, capture_output=True, text=True, check=False)


def non_vitest_command(validation: str, baseline: str, head: str) -> list[str]:
    """Return the one bounded command that proves a declared non-Vitest check."""
    commands = {
        "customization-boundary-validator": [
            "python3",
            ".linktrend/openclaw-prime/validate_customization_boundary.py",
        ],
        "progressive-validation-tests": [
            "env", "PYTHONPATH=.", "python3", "-m", "unittest", "discover",
            "-s", "test", "-p", "openclaw_progressive_validation.py",
        ],
        "execution-approval-tests": [
            "env", "PYTHONPATH=.", "python3", "-m", "unittest", "discover",
            "-s", "docs/execution/openclaw-prime-lisa/tests", "-p",
            "test_execution_approval_snapshot.py",
        ],
        "phase-packager-history-tests": [
            "env", "PYTHONPATH=.", "python3", "-m", "unittest", "discover",
            "-s", "test", "-p", "packager_coordinator_phase_history.py",
        ],
        "phase-diff-check": ["git", "diff", "--check", baseline, head],
    }
    command = commands.get(validation)
    if command is None:
        raise RuntimeError("relevant_tests_unresolved")
    return command


def run_non_vitest_validations(
    root: Path,
    baseline: str,
    head: str,
    validations: Sequence[Mapping[str, str]],
    runner: ValidationRunner | None = None,
) -> list[dict[str, Any]]:
    """Execute every declared fork-only validation and retain its exact file binding."""
    grouped: dict[str, list[str]] = {}
    for item in validations:
        path = item.get("path")
        validation = item.get("validation")
        if not isinstance(path, str) or not isinstance(validation, str):
            raise RuntimeError("relevant_tests_unresolved")
        grouped.setdefault(validation, []).append(path)

    results: list[dict[str, Any]] = []
    for validation in sorted(grouped):
        command = non_vitest_command(validation, baseline, head)
        executed = (runner or (lambda args: _run_captured(args, root)))(command)
        output = (executed.stdout or "") + "\n" + (executed.stderr or "")
        if executed.returncode != 0:
            raise RuntimeError("relevant_tests_failed")
        results.append({
            "validation": validation,
            "paths": sorted(grouped[validation]),
            "command": command,
            "ok": True,
            "runOutputDigest": canonical_digest(output),
        })
    return results


def test_plan_is_broad(output: str, existing_paths: Sequence[str]) -> bool:
    lowered = output.lower()
    if any(marker in output for marker in BROAD_TEST_MARKERS):
        return True
    if "running " in lowered and "vitest shards" in lowered:
        match = re.search(r"running (\d+) Vitest shards", output)
        if match and int(match.group(1)) > 20:
            return True
    listed = parse_test_list(output)
    if not listed:
        return False
    prefixes = {path.rsplit("/", 1)[0] for path in existing_paths if "/" in path}
    prefixes.update({"src/agents", "src/plugin-sdk", "extensions/codex", "scripts"})
    unrelated = [
        test
        for test in listed
        if not any(test == path or test.startswith(prefix + "/") for path in existing_paths for prefix in prefixes)
        and not any(test.startswith(prefix + "/") for prefix in prefixes)
    ]
    return len(unrelated) > 12


def run_relevant_tests(
    root: Path,
    baseline: str,
    head: str,
    changed_paths: Sequence[str],
    *,
    execute: bool,
    planner_runner: PlannerRunner | None = None,
    test_runner: TestRunner | None = None,
    validation_runner: ValidationRunner | None = None,
) -> dict[str, Any]:
    if not changed_paths:
        return {
            "command": None,
            "mode": "empty-diff",
            "selectedTests": [],
            "nonVitestResults": [],
            "approvedTestPlan": None,
            "broadFallback": False,
            "skippedChangedPaths": False,
            "ok": True,
            "output": "",
        }
    if not execute:
        return {
            "command": None,
            "mode": "deferred-hosted",
            "selectedTests": [],
            "nonVitestResults": [],
            "approvedTestPlan": None,
            "broadFallback": False,
            "skippedChangedPaths": False,
            "ok": True,
        }
    approved = invoke_planner(root, baseline, head, changed_paths, planner_runner)
    targets = list(approved["targets"])
    non_vitest_results = run_non_vitest_validations(
        root,
        baseline,
        head,
        approved["nonVitestValidations"],
        validation_runner,
    )
    if not targets:
        return {
            "command": None,
            "mode": "execute",
            "selectedTests": [],
            "nonVitestResults": non_vitest_results,
            "approvedTestPlan": approved,
            "broadFallback": False,
            "skippedChangedPaths": False,
            "ok": True,
            "runOutputDigest": None,
        }
    run_cmd = list(TEST_PROJECTS) + targets
    if "--changed" in run_cmd or len(run_cmd) <= len(TEST_PROJECTS):
        raise RuntimeError("relevant_tests_broadened")
    executed = (test_runner or (lambda command: _run_captured(command, root)))(run_cmd)
    run_output = (executed.stdout or "") + "\n" + (executed.stderr or "")
    if test_plan_is_broad(run_output, changed_paths):
        raise RuntimeError("relevant_tests_broadened")
    if executed.returncode != 0:
        raise RuntimeError("relevant_tests_failed")
    selected = parse_test_list(run_output) or list(targets)
    return {
        "command": run_cmd,
        "mode": "execute",
        "selectedTests": selected,
        "nonVitestResults": non_vitest_results,
        "approvedTestPlan": approved,
        "broadFallback": False,
        "skippedChangedPaths": False,
        "ok": True,
        "runOutputDigest": canonical_digest(run_output),
    }


def run_diff_check(root: Path, baseline: str, head: str) -> None:
    result = subprocess.run(
        ["git", "diff", "--check", baseline, head],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode:
        raise RuntimeError("diff_check")


def write_evidence(path: Path, payload: Mapping[str, Any]) -> str:
    text = json.dumps(payload, sort_keys=True, indent=2) + "\n"
    path.write_text(text, encoding="utf-8")
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def validate_phase(
    *,
    root: Path,
    profile: str,
    baseline: str | None = None,
    head: str = "HEAD",
    scanner: Scanner | None = None,
    changed: Sequence[str] | None = None,
    execute_tests: bool | None = None,
    write_evidence_file: bool = True,
    planner_runner: PlannerRunner | None = None,
    test_runner: TestRunner | None = None,
    validation_runner: ValidationRunner | None = None,
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

    if profile not in {"fast", "full"}:
        return {
            "ok": False,
            "errors": ["progressive_validation_profile_invalid"],
            "hold": HOLD_IDENTITY,
            "profile": profile,
            "consumerWorkflows": names,
        }

    identity: dict[str, Any] | None = None
    existing: list[str]
    deleted: list[str] = []
    classifications: dict[str, str] = {}
    if changed is not None:
        for path in changed:
            if _unsafe_path(path):
                return {
                    "ok": False,
                    "errors": ["unsafe_path"],
                    "hold": HOLD_IDENTITY,
                    "profile": profile,
                    "consumerWorkflows": names,
                }
        existing = sorted(set(changed))
        classifications = static_classifications(root, existing, manifest)
    else:
        baseline_ref = baseline or os.environ.get("BASELINE_SHA") or os.environ.get("BASELINE_REF") or "origin/development"
        try:
            identity = inspect_phase_diff(root, baseline_ref, head)
            run_diff_check(root, identity["baselineCommit"], identity["headCommit"])
        except PhaseIdentityError as exc:
            return {
                "ok": False,
                "errors": [str(exc)],
                "hold": HOLD_IDENTITY,
                "profile": profile,
                "consumerWorkflows": names,
            }
        except RuntimeError as exc:
            return {
                "ok": False,
                "errors": [str(exc)],
                "hold": HOLD_IDENTITY,
                "profile": profile,
                "consumerWorkflows": names,
            }
        existing = list(identity["existingPaths"])
        deleted = list(identity["deletedPaths"])
        classifications = static_classifications(root, existing + deleted, manifest)

    # Proven Phase paths are admitted even when static inventory would call them
    # untouched-upstream. Static classes stay evidence-only.
    admitted = list(existing)
    scan_result: Mapping[str, Any] = {"findings": [], "ok": True, "scannedPaths": []}
    if not errors:
        try:
            scan_result = scan_existing(root, admitted, scanner)
        except RuntimeError as exc:
            errors.append(str(exc))
            hold = HOLD_SCAN

    test_result: dict[str, Any] = {
        "selectedTests": [],
        "mode": "not-run",
        "ok": True,
        "broadFallback": False,
    }
    hosted = os.environ.get("GITHUB_ACTIONS") == "true"
    should_execute = execute_tests if execute_tests is not None else (profile == "full" and hosted)
    if not errors and profile == "full" and changed is None and identity is not None:
        try:
            test_result = run_relevant_tests(
                root,
                identity["baselineCommit"],
                identity["headCommit"],
                existing + deleted,
                execute=should_execute,
                planner_runner=planner_runner,
                test_runner=test_runner,
                validation_runner=validation_runner,
            )
        except RuntimeError as exc:
            errors.append(str(exc))
            hold = HOLD_TESTS

    evidence = {
        "schemaVersion": 1,
        "kind": "customization-validation-evidence",
        "profile": profile,
        "baselineCommit": None if identity is None else identity["baselineCommit"],
        "baselineTree": None if identity is None else identity["baselineTree"],
        "headCommit": None if identity is None else identity["headCommit"],
        "headTree": None if identity is None else identity["headTree"],
        "normalizedDiff": [] if identity is None else identity["normalizedDiff"],
        "normalizedDiffDigest": None if identity is None else identity["normalizedDiffDigest"],
        "requestedPaths": admitted,
        "scannedExistingPaths": list(scan_result.get("scannedPaths") or []),
        "deletedPaths": deleted,
        "pathDigests": {} if identity is None else identity["pathDigests"],
        "staticClassifications": classifications,
        "approvedTestPlan": test_result.get("approvedTestPlan"),
        "selectedTestPlan": test_result.get("selectedTests"),
        "selectedTestResults": {
            "ok": test_result.get("ok"),
            "mode": test_result.get("mode"),
            "broadFallback": test_result.get("broadFallback"),
            "command": test_result.get("command"),
            "runOutputDigest": test_result.get("runOutputDigest"),
        },
        "nonVitestValidationResults": test_result.get("nonVitestResults") or [],
        "workflow": os.environ.get("GITHUB_WORKFLOW"),
        "run": os.environ.get("GITHUB_RUN_ID"),
        "attempt": os.environ.get("GITHUB_RUN_ATTEMPT"),
        "untouchedUpstreamEvaluated": False,
        "consumerWorkflows": names,
    }
    evidence_digest = None
    if write_evidence_file and not errors:
        evidence_digest = write_evidence(root / EVIDENCE_REL, evidence)

    return {
        "ok": not errors,
        "errors": errors,
        "hold": hold,
        "profile": profile,
        "baseline": None if identity is None else identity["baselineCommit"],
        "head": None if identity is None else identity["headCommit"],
        "baselineTree": None if identity is None else identity["baselineTree"],
        "headTree": None if identity is None else identity["headTree"],
        "changedPaths": admitted + deleted,
        "classifications": classifications,
        "admittedPaths": admitted,
        "excludedPaths": [],
        "deletedPaths": deleted,
        "scannedPaths": list(scan_result.get("scannedPaths") or []),
        "findings": list(scan_result.get("findings") or []),
        "consumerWorkflows": names,
        "requireOwnFullWorkflow": False,
        "aggregateCheck": SELF_WORKFLOW_NAME,
        "untouchedUpstreamEvaluated": False,
        "evidence": evidence,
        "evidenceDigest": evidence_digest,
        "selectedTests": test_result.get("selectedTests") or [],
    }


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=("fast", "full"), default="fast")
    parser.add_argument("--baseline")
    parser.add_argument("--head", default="HEAD")
    parser.add_argument("--evidence-output", default=EVIDENCE_REL)
    return parser.parse_args(list(argv) if argv is not None else None)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    root = Path.cwd()
    result = validate_phase(
        root=root,
        profile=args.profile,
        baseline=args.baseline,
        head=args.head,
    )
    print(json.dumps({k: v for k, v in result.items() if k != "evidence"}, sort_keys=True, indent=2))
    if not result["ok"]:
        print(result.get("hold") or "HOLD: customization_validation_failed", file=sys.stderr)
        return 1
    print(
        f"customization-scoped {args.profile}: ok admitted={len(result['admittedPaths'])} "
        f"deleted={len(result['deletedPaths'])} untouchedUpstreamEvaluated=false"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

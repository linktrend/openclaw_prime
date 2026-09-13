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
    "linkbots/lisa/docs/LISA-BACKUP-DEPLOYMENT-RUNBOOK.md": "phase-diff-check",
    "linkbots/lisa/docs/LISA-JOBS-SOURCE-OPERATIONS.md": "phase-diff-check",
    "linkbots/lisa/docs/LISA-MODEL-ROUTING-CONTRACT-2026-08-01.md": "phase-diff-check",
    "linkbots/lisa/docs/LISA-MODEL-ROUTING-EVAL-PKT04-2026-09-11.md": "phase-diff-check",
    "linkbots/lisa/docs/LISA-PKT-09-SOURCE-ACCEPTANCE.md": "phase-diff-check",
    "linkbots/lisa/ops/backup/backup.test.ts": "phase-diff-check",
    "linkbots/lisa/ops/backup/vitest.config.ts": "phase-diff-check",
    "linkbots/lisa/ops/deployment/deployment.test.ts": "phase-diff-check",
    "linkbots/lisa/ops/deployment/vitest.config.ts": "phase-diff-check",
    "linkbots/lisa/ops/jobs/lisa-job-catalogue.test.ts": "phase-diff-check",
    "linkbots/lisa/ops/jobs/lisa-job-desired-state.ts": "phase-diff-check",
    "linkbots/lisa/ops/jobs/time-management/procedure.md": "lisa-time-management-tests",
    "linkbots/lisa/ops/model-routing.contract.json": "phase-diff-check",
    "linkbots/lisa/ops/model-routing.test.ts": "phase-diff-check",
    "linkbots/lisa/ops/templates/README.md": "lisa-template-registry-tests",
    "src/commands/agents.config.ts": "agents-config-tests",
    "src/state/lisa-compliance-state-schema.ts": "phase-diff-check",
    "src/state/lisa-principal-task-schema.ts": "phase-diff-check",
    "test/vitest/vitest.linkbots-paths.d.mts": "phase-diff-check",
    "test/vitest/vitest.linkbots-paths.mjs": "phase-diff-check",
    "test/vitest/vitest.tooling.config.ts": "phase-diff-check",
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
    "scripts/gitops/coordinator/state.py": "phase-integrator-tests",
    "scripts/gitops/phase_integrator.py": "phase-integrator-tests",
    "scripts/gitops/receipt_seal.py": "receipt-seal-tests",
    "test/phase_integrator.py": "phase-integrator-tests",
    "test/receipt_seal.py": "receipt-seal-tests",
}
# Exact Full run 34738525501 production paths that the TypeScript resolver
# skipped or left targetless. Keep this list path-exact; no prefixes.
FOCUSED_VITEST_TARGETS = {
    "extensions/linkautowork/api.ts": "extensions/linkautowork/capability-gates.test.ts",
    "extensions/linkautowork/src/capability-gates.ts": "extensions/linkautowork/capability-gates.test.ts",
    "extensions/linkautowork/src/contract-pins.ts": "extensions/linkautowork/contract.test.ts",
    "extensions/linkautowork/src/contract.ts": "extensions/linkautowork/contract.test.ts",
    "extensions/linkbrain/api.ts": "extensions/linkbrain/capability-gates.test.ts",
    "extensions/linkbrain/fake/runtime.mjs": "extensions/linkbrain/runtime.test.ts",
    "extensions/linkbrain/src/capability-gates.ts": "extensions/linkbrain/capability-gates.test.ts",
    "extensions/linkbrain/src/oauth-tool.ts": "extensions/linkbrain/oauth-tool.test.ts",
    "extensions/linkbrain/src/standard-mcp-v2.ts": "extensions/linkbrain/standard-mcp-v2.test.ts",
    "extensions/linklibraries/api.ts": "extensions/linklibraries/capability-gates.test.ts",
    "extensions/linklibraries/src/capability-gates.ts": "extensions/linklibraries/capability-gates.test.ts",
    "extensions/linklibraries/src/revision2-pins.ts": "extensions/linklibraries/revision2-contract.test.ts",
    "extensions/linklibraries/src/revision2.ts": "extensions/linklibraries/revision2-contract.test.ts",
    "extensions/linkplatform/api.ts": "extensions/linkplatform/capability-gates.test.ts",
    "extensions/linkplatform/src/capability-gates.ts": "extensions/linkplatform/capability-gates.test.ts",
    "extensions/linkplatform/src/claims.ts": "extensions/linkplatform/claims.test.ts",
    "extensions/linkplatform/src/integration-status.ts": "extensions/linkplatform/integration-status.test.ts",
    "extensions/linkplatform/src/timestamps.ts": "extensions/linkplatform/integration-status.test.ts",
    "extensions/linkskills/api.ts": "extensions/linkskills/capability-gates.test.ts",
    "extensions/linkskills/fake/service.mjs": "extensions/linkskills/capability-gates.test.ts",
    "extensions/linkskills/src/capability-gates.ts": "extensions/linkskills/capability-gates.test.ts",
    "extensions/linkskills/src/oauth-tool.ts": "extensions/linkskills/oauth-tool.test.ts",
    "extensions/linkskills/src/standard-mcp-v2.ts": "extensions/linkskills/standard-mcp-v2.test.ts",
    "extensions/linkskills/src/transport.ts": "extensions/linkskills/transport.test.ts",
    "linkbots/blueprints/vitest.config.ts": "linkbots/blueprints/executive-blueprints.test.ts",
    "linkbots/lisa/ops/backup/backup.ts": "linkbots/lisa/ops/backup/backup.test.ts",
    "linkbots/lisa/ops/browser/browser-runtime-policy.ts": "linkbots/lisa/ops/browser/browser-runtime-policy.test.ts",
    "linkbots/lisa/ops/deployment/deployment.ts": "linkbots/lisa/ops/deployment/deployment.test.ts",
    "linkbots/lisa/ops/google-workspace/qualification-receipt.mjs": (
        "linkbots/lisa/ops/google-workspace/qualification-receipt.test.mjs"
    ),
    "linkbots/lisa/ops/jobs/lisa-job-catalogue.ts": "linkbots/lisa/ops/jobs/lisa-job-catalogue.test.ts",
    "linkbots/lisa/ops/jobs/lisa-job-contracts.ts": "linkbots/lisa/ops/jobs/lisa-job-catalogue.test.ts",
    "linkbots/lisa/ops/model-routing.ts": "linkbots/lisa/ops/model-routing.test.ts",
    "scripts/run-vitest.mts": "test/scripts/run-vitest.test.ts",
    "scripts/test-projects.test-support.mts": "test/scripts/test-projects-routing.test.ts",
    "src/agents/agent-create.ts": "src/agents/agent-create.test.ts",
    "src/agents/agent-scope.ts": "src/agents/agent-scope.test.ts",
    "src/agents/noncoding-route.ts": "src/agents/noncoding-route.test.ts",
    "src/agents/prepared-model-catalog.ts": "src/agents/prepared-model-catalog.test.ts",
    "src/agents/prepared-model-runtime.ts": "src/agents/prepared-model-runtime.test.ts",
    "src/agents/profile-manifest.ts": "src/agents/profile-manifest.test.ts",
    "src/agents/sandbox/browser-policy.ts": "src/agents/sandbox/browser-policy.test.ts",
    "src/agents/tools/web-fetch.ts": "src/agents/tools/web-fetch.test.ts",
    "src/agents/tools/web-search.ts": "src/agents/tools/web-search.test.ts",
    "src/state/lisa-compliance-state-store.ts": "src/state/lisa-compliance-state-store.test.ts",
    "src/state/lisa-principal-task-store.ts": "src/state/lisa-principal-task-store.test.ts",
    "src/web-fetch/governed-runtime.ts": "src/web-fetch/governed-runtime.test.ts",
    "src/web-search/governed-runtime.ts": "src/web-search/governed-runtime.test.ts",
}
TEST_FILE_SUFFIXES = (
    ".test.ts",
    ".test.mts",
    ".test.tsx",
    ".test.cts",
    ".test.js",
    ".test.mjs",
    ".test.cjs",
    ".spec.ts",
    ".spec.mts",
    ".spec.js",
)
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


class SecretScanHold(RuntimeError):
    """Scoped scan blocked; payload must stay attached to the hold."""

    def __init__(self, code: str, payload: Mapping[str, Any]) -> None:
        super().__init__(code)
        self.code = code
        self.payload = dict(payload)


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
    findings = result.get("findings")
    if not isinstance(findings, list):
        raise RuntimeError("scanner-error")
    payload = dict(result)
    payload["scannedPaths"] = list(scanned)
    payload["findings"] = list(findings)

    def hold(code: str) -> None:
        raise SecretScanHold(code, payload)

    admitted_set = set(admitted)
    scanned_set = set(scanned)
    extra = sorted(scanned_set - admitted_set)
    if extra:
        hold("scanner_escaped_scope")
    if scanned_set != admitted_set or len(scanned) != len(scanned_set):
        hold("scanner_incomplete_scope")
    allowed_kinds = {SKIPPED_KIND, load_secret_scan(root).KIND_APPROVED}
    for row in findings:
        if not isinstance(row, Mapping):
            hold("scanner-error")
        kind = row.get("kind")
        path = row.get("path")
        if path is not None and path not in admitted:
            hold("scanner_escaped_scope")
        if kind == SKIPPED_KIND:
            hold("new-skipped-input")
        if kind and kind not in allowed_kinds:
            hold("new-or-changed-finding")
    if result.get("ok") is False:
        # Scanner refused the run without a blocking finding row. That is a
        # scanner contract failure, not a new/changed secret finding.
        hold("scanner-error")
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


def _is_test_file(path: str) -> bool:
    return path.endswith(TEST_FILE_SUFFIXES)


def _head_blob_exists(root: Path, head_commit: str, path: str) -> bool:
    probe = subprocess.run(
        ["git", "cat-file", "-e", f"{head_commit}:{path}"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    return probe.returncode == 0


def _discover_focused_vitest_target(path: str, root: Path, head_commit: str) -> str | None:
    """Return one HEAD-existing focused test, or None when the path stays unmapped."""
    declared = FOCUSED_VITEST_TARGETS.get(path)
    if declared is not None:
        if not _head_blob_exists(root, head_commit, declared):
            raise RuntimeError("relevant_tests_unresolved")
        return declared
    if _is_test_file(path):
        return path
    parent, _, name = path.rpartition("/")
    stem = name.rsplit(".", 1)[0] if "." in name else name
    candidates = [
        f"{parent}/{stem}.test.ts" if parent else f"{stem}.test.ts",
        f"{parent}/{stem}.test.mts" if parent else f"{stem}.test.mts",
        f"{parent}/{stem}.test.mjs" if parent else f"{stem}.test.mjs",
    ]
    if parent.endswith("/src"):
        pkg = parent[: -len("/src")]
        candidates.extend(
            [
                f"{pkg}/{stem}.test.ts",
                f"{pkg}/{stem}.test.mjs",
            ]
        )
    if path.startswith("scripts/"):
        script_stem = path[len("scripts/") :].rsplit(".", 1)[0]
        dashed = script_stem.replace("/", "-")
        candidates.extend(
            [
                f"test/scripts/{script_stem}.test.ts",
                f"test/scripts/{dashed}.test.ts",
                f"test/scripts/{stem}.test.ts",
            ]
        )
    for candidate in candidates:
        if candidate and _head_blob_exists(root, head_commit, candidate):
            return candidate
    return None


def declared_non_vitest_validations(changed_paths: Sequence[str]) -> list[dict[str, str]]:
    return [
        {"path": path, "validation": NON_VITEST_VALIDATION[path]}
        for path in changed_paths
        if path in NON_VITEST_VALIDATION
    ]


def build_focused_customization_plan(
    root: Path,
    baseline_commit: str,
    head_commit: str,
    changed_paths: Sequence[str],
) -> dict[str, Any]:
    """Map each changed path to a declared non-Vitest check or one focused test."""
    expected_paths = sorted(set(changed_paths))
    targets: list[str] = []
    for path in expected_paths:
        if path in NON_VITEST_VALIDATION:
            continue
        target = _discover_focused_vitest_target(path, root, head_commit)
        if target:
            targets.append(target)
            continue
        if path.endswith(CODE_SUFFIXES):
            raise RuntimeError("relevant_tests_unresolved")
    payload = {
        "schemaVersion": 1,
        "kind": "customization-test-target-plan",
        "mode": "targets",
        "targets": sorted(set(targets)),
        "skippedBroadFallbackPaths": [],
        "nonVitestValidations": declared_non_vitest_validations(expected_paths),
        "changedPaths": expected_paths,
        "changedPathsDigest": canonical_digest(expected_paths),
        "baselineCommit": baseline_commit,
        "headCommit": head_commit,
    }
    return validate_planner_payload(payload, expected_paths, baseline_commit, head_commit, root)


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
    expected_non_vitest = declared_non_vitest_validations(expected_paths)
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
        try:
            return build_focused_customization_plan(root, baseline, head, changed_paths)
        except RuntimeError as exc:
            raise RuntimeError("relevant_tests_unresolved") from exc
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
        "phase-integrator-tests": [
            "env", "PYTHONPATH=.", "python3", "-m", "unittest", "discover",
            "-s", "test", "-p", "phase_integrator.py",
        ],
        "receipt-seal-tests": [
            "env", "PYTHONPATH=.", "python3", "-m", "unittest", "discover",
            "-s", "test", "-p", "receipt_seal.py",
        ],
        "phase-diff-check": ["git", "diff", "--check", baseline, head],
        "lisa-time-management-tests": [
            "node",
            "scripts/run-vitest.mjs",
            "linkbots/lisa/ops/jobs/time-management/time-management.test.ts",
        ],
        "lisa-template-registry-tests": [
            "node",
            "scripts/run-vitest.mjs",
            "linkbots/lisa/ops/templates/template-registry.test.ts",
        ],
        "agents-config-tests": [
            "node",
            "scripts/run-vitest.mjs",
            "src/commands/agents.test.ts",
        ],
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
        except SecretScanHold as exc:
            errors.append(exc.code)
            hold = HOLD_SCAN
            scan_result = exc.payload
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

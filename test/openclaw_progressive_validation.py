"""Focused tests for customization-scoped Fast/Full validation."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

MODULE_PATH = ROOT / ".github" / "openclaw_progressive_validation.py"
SPEC = spec_from_file_location("openclaw_progressive_validation", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

OCP01_BASE = "7aee52d52695ab50bfa13dd275a68d28a5cbbe6b"
OCP01_HEAD = "566d6f2140fd86c5fb6fee7da6d58b3629442287"
OCP01_PATHS = (
    "extensions/codex/src/app-server/client-runtime.ts",
    "extensions/codex/src/app-server/event-projector-terminal-failure.ts",
    "extensions/codex/src/app-server/event-projector.terminal-errors.test.ts",
    "extensions/codex/src/app-server/outcome-fallback-runtime-contract.test.ts",
    "extensions/codex/src/app-server/run-attempt-finalize.ts",
    "scripts/plugin-sdk-surface-report.mts",
    "src/agents/auth-profiles/oauth-refresh-failure.test.ts",
    "src/agents/auth-profiles/oauth-refresh-failure.ts",
    "src/agents/embedded-agent-runner/result-fallback-classifier.test.ts",
    "src/agents/embedded-agent-runner/result-fallback-classifier.ts",
    "src/agents/embedded-agent-runner/run/terminal-resolution.ts",
    "src/agents/failover/classify.test.ts",
    "src/agents/failover/classify.ts",
    "src/agents/model-fallback.run-embedded.e2e.test-support.ts",
    "src/agents/model-fallback.run-embedded.e2e.test.ts",
    "src/plugin-sdk/agent-harness-runtime.test.ts",
    "src/plugin-sdk/agent-harness-runtime.ts",
)


def _ok_scan(_root: Path, paths: list[str] | tuple[str, ...]) -> dict[str, object]:
    return {"ok": True, "findings": [], "scannedPaths": list(paths)}


# Synthetic fixture identity only. Hosted Full installs set the parent
# `core.hooksPath` (pnpm prepare → git-hooks); linked worktrees inherit that
# config and lack node_modules, so pre-commit/oxfmt abort the probe commit.
# Process-local -c plus env identity; never read or write global Git config.
_FIXTURE_GIT_NAME = "OpenClaw Prime Test Fixture"
_FIXTURE_GIT_EMAIL = "openclaw-prime-test-fixture@example.invalid"
_FIXTURE_GIT_CONFIG = (
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "commit.gpgsign=false",
    "-c",
    f"user.name={_FIXTURE_GIT_NAME}",
    "-c",
    f"user.email={_FIXTURE_GIT_EMAIL}",
)


def _fixture_git_env() -> dict[str, str]:
    env = os.environ.copy()
    env.update(
        {
            "GIT_AUTHOR_NAME": _FIXTURE_GIT_NAME,
            "GIT_AUTHOR_EMAIL": _FIXTURE_GIT_EMAIL,
            "GIT_COMMITTER_NAME": _FIXTURE_GIT_NAME,
            "GIT_COMMITTER_EMAIL": _FIXTURE_GIT_EMAIL,
        }
    )
    return env


def _git(cwd: Path, *args: str) -> str:
    argv = ["git", *_FIXTURE_GIT_CONFIG, *args]
    if args[:1] == ("commit",) and "--allow-empty" not in args:
        staged = subprocess.run(
            ["git", *_FIXTURE_GIT_CONFIG, "diff", "--cached", "--quiet"],
            cwd=cwd,
            capture_output=True,
            text=True,
            check=False,
            env=_fixture_git_env(),
        )
        if staged.returncode == 0:
            raise RuntimeError("fixture commit has no staged changes")
        if staged.returncode != 1:
            detail = (staged.stderr or staged.stdout).strip() or f"exit {staged.returncode}"
            raise RuntimeError(f"git diff --cached --quiet failed: {detail}")
        if "--no-verify" not in args:
            argv = ["git", *_FIXTURE_GIT_CONFIG, "commit", "--no-verify", *args[1:]]
    result = subprocess.run(
        argv,
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
        env=_fixture_git_env(),
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip() or f"exit {result.returncode}"
        raise RuntimeError(f"{' '.join(argv)} failed: {detail}")
    return result.stdout.strip()


def _init_repo() -> Path:
    root = Path(tempfile.mkdtemp())
    _git(root, "init")
    _git(root, "config", "user.email", "gate@example.invalid")
    _git(root, "config", "user.name", "gate")
    (root / "owned.txt").write_text("owned\n", encoding="utf-8")
    _git(root, "add", "owned.txt")
    _git(root, "commit", "-m", "base")
    return root


class ProgressiveValidationTests(unittest.TestCase):
    def test_consumer_workflow_names_are_customization_scoped(self) -> None:
        names = MODULE.consumer_workflow_names(ROOT)
        self.assertEqual(names["ciWorkflowName"], "Linktrend Full Suite")
        self.assertEqual(names["fastWorkflowName"], "Linktrend Fast Checks")
        self.assertNotEqual(names["ciWorkflowName"], "CI")
        contract = json.loads((ROOT / ".github/linktrend-repository-ci-contract.json").read_text(encoding="utf-8"))
        self.assertEqual(contract["aggregateContext"], "Linktrend Full Suite")
        self.assertEqual(contract["profiles"]["fast"]["requiredCheckContexts"], ["Linktrend Fast Checks"])
        self.assertEqual(contract["profiles"]["full"]["requiredCheckContexts"], ["Linktrend Full Suite"])
        self.assertNotIn(["python3", "scripts/gitops/secret_scan.py"], contract["profiles"]["fast"]["commands"])
        self.assertNotIn(["python3", "scripts/gitops/secret_scan.py"], contract["profiles"]["full"]["commands"])
        consumer = json.loads((ROOT / ".github/linktrend-gitops-consumer.json").read_text(encoding="utf-8"))
        self.assertEqual(consumer["ciWorkflowName"], "Linktrend Full Suite")
        delivery = json.loads((ROOT / ".github/linktrend-delivery-mode.json").read_text(encoding="utf-8"))
        self.assertEqual(delivery["profiles"]["fast"]["commands"], contract["profiles"]["fast"]["commands"])
        self.assertEqual(delivery["profiles"]["full"]["commands"], contract["profiles"]["full"]["commands"])
        history_cmd = [
            "env",
            "PYTHONPATH=.",
            "python3",
            "-m",
            "unittest",
            "discover",
            "-s",
            "test",
            "-p",
            "packager_coordinator_phase_history.py",
        ]
        broken_history_cmd = [
            "env",
            "PYTHONPATH=.",
            "python3",
            "-m",
            "unittest",
            "test/packager_coordinator_phase_history.py",
        ]
        self.assertIn(history_cmd, delivery["profiles"]["fast"]["commands"])
        self.assertIn(history_cmd, delivery["profiles"]["full"]["commands"])
        self.assertNotIn(broken_history_cmd, delivery["profiles"]["fast"]["commands"])
        self.assertNotIn(broken_history_cmd, delivery["profiles"]["full"]["commands"])
        full_commands = json.dumps(delivery["profiles"]["full"]["commands"])
        for required in (
            ".linktrend/openclaw-prime/validate_customization_boundary.py",
            "openclaw_progressive_validation.py",
            "test_execution_approval_snapshot.py",
            "packager_coordinator_phase_history.py",
        ):
            self.assertIn(required, full_commands)

    def test_clean_shell_direct_invocation_imports_scanner(self) -> None:
        env = os.environ.copy()
        env.pop("PYTHONPATH", None)
        proc = subprocess.run(
            [
                "env",
                "-u",
                "PYTHONPATH",
                "python3",
                ".github/openclaw_progressive_validation.py",
                "--profile",
                "fast",
                "--baseline",
                OCP01_BASE,
                "--head",
                OCP01_HEAD,
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
            env=env,
        )
        evidence = ROOT / "customization-validation-evidence.json"
        if evidence.is_file():
            evidence.unlink()
        self.assertNotIn("ModuleNotFoundError", proc.stderr)
        self.assertNotIn("No module named 'scripts'", proc.stderr)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        payload = json.loads(proc.stdout.split("customization-scoped")[0])
        self.assertEqual(payload["admittedPaths"], list(OCP01_PATHS))
        self.assertFalse(payload["untouchedUpstreamEvaluated"])

    def test_ocp01_exact_17_path_admission(self) -> None:
        recorded: list[str] = []

        def scanner(_root: Path, paths: list[str] | tuple[str, ...]) -> dict[str, object]:
            recorded.extend(paths)
            return _ok_scan(_root, paths)

        result = MODULE.validate_phase(
            root=ROOT,
            profile="fast",
            baseline=OCP01_BASE,
            head=OCP01_HEAD,
            scanner=scanner,
            execute_tests=False,
            write_evidence_file=False,
        )
        self.assertTrue(result["ok"], result)
        self.assertEqual(result["admittedPaths"], list(OCP01_PATHS))
        self.assertEqual(len(result["admittedPaths"]), 17)
        self.assertEqual(result["excludedPaths"], [])
        self.assertEqual(sorted(recorded), list(OCP01_PATHS))
        self.assertNotIn("src/index.ts", result["scannedPaths"])
        self.assertNotIn("src/index.ts", result["admittedPaths"])
        self.assertNotIn("src/index.ts", result["selectedTests"])
        self.assertFalse(result["untouchedUpstreamEvaluated"])
        self.assertEqual(result["baseline"], OCP01_BASE)
        self.assertEqual(result["head"], OCP01_HEAD)

    def test_static_classifier_does_not_exclude_proven_phase_paths(self) -> None:
        classifier = MODULE.load_classifier(ROOT)
        manifest = MODULE.load_manifest(ROOT)
        self.assertEqual(
            classifier.classify("src/plugin-sdk/agent-harness-runtime.ts", manifest),
            "untouched-upstream-excluded",
        )
        result = MODULE.validate_phase(
            root=ROOT,
            profile="fast",
            baseline=OCP01_BASE,
            head=OCP01_HEAD,
            scanner=_ok_scan,
            execute_tests=False,
            write_evidence_file=False,
        )
        self.assertIn("src/plugin-sdk/agent-harness-runtime.ts", result["admittedPaths"])
        self.assertEqual(result["excludedPaths"], [])

    def test_path_scoped_secret_skipped_and_out_of_scope_findings_block(self) -> None:
        secret = MODULE.validate_phase(
            root=ROOT,
            profile="fast",
            changed=[".github/linktrend-gitops-consumer.json"],
            scanner=lambda _root, paths: {
                "ok": False,
                "findings": [
                    {
                        "kind": "credential",
                        "path": ".github/linktrend-gitops-consumer.json",
                        "rule": "format.github",
                    }
                ],
                "scannedPaths": list(paths),
            },
            write_evidence_file=False,
        )
        self.assertFalse(secret["ok"])
        self.assertEqual(secret["hold"], MODULE.HOLD_SCAN)
        self.assertIn("new-or-changed-finding", secret["errors"])

        skipped = MODULE.validate_phase(
            root=ROOT,
            profile="fast",
            changed=[".github/linktrend-gitops-consumer.json"],
            scanner=lambda _root, paths: {
                "ok": True,
                "findings": [
                    {
                        "kind": "skipped_input",
                        "path": ".github/linktrend-gitops-consumer.json",
                        "rule": "input.undecodable",
                    }
                ],
                "scannedPaths": list(paths),
            },
            write_evidence_file=False,
        )
        self.assertFalse(skipped["ok"])
        self.assertEqual(skipped["hold"], MODULE.HOLD_SCAN)
        self.assertIn("new-skipped-input", skipped["errors"])

        escaped = MODULE.validate_phase(
            root=ROOT,
            profile="fast",
            changed=[".github/linktrend-gitops-consumer.json"],
            scanner=lambda _root, paths: {
                "ok": True,
                "findings": [{"kind": "credential", "path": "src/index.ts", "rule": "format.github"}],
                "scannedPaths": list(paths),
            },
            write_evidence_file=False,
        )
        self.assertFalse(escaped["ok"])
        self.assertIn("scanner_escaped_scope", escaped["errors"])

        incomplete = MODULE.validate_phase(
            root=ROOT,
            profile="fast",
            changed=[".github/linktrend-gitops-consumer.json"],
            scanner=lambda _root, _paths: {
                "ok": True,
                "findings": [],
                "scannedPaths": [],
            },
            write_evidence_file=False,
        )
        self.assertFalse(incomplete["ok"])
        self.assertIn("scanner_incomplete_scope", incomplete["errors"])

    def test_upstream_untouched_files_absent_from_scan_and_test_evidence(self) -> None:
        recorded: list[str] = []

        def scanner(_root: Path, paths: list[str] | tuple[str, ...]) -> dict[str, object]:
            recorded.extend(paths)
            return _ok_scan(_root, paths)

        result = MODULE.validate_phase(
            root=ROOT,
            profile="fast",
            baseline=OCP01_BASE,
            head=OCP01_HEAD,
            scanner=scanner,
            execute_tests=False,
            write_evidence_file=False,
        )
        untouched = ("src/index.ts", "extensions/telegram/src/index.ts", "test/helpers/fixture.ts")
        for path in untouched:
            self.assertNotIn(path, recorded)
            self.assertNotIn(path, result["scannedPaths"])
            self.assertNotIn(path, result["admittedPaths"])
            self.assertNotIn(path, result["evidence"]["requestedPaths"])
            self.assertNotIn(path, result["selectedTests"])

    def test_deletion_rename_and_submodule_handling(self) -> None:
        root = _init_repo()
        base = _git(root, "rev-parse", "HEAD")
        (root / "gone.txt").write_text("delete-me\n", encoding="utf-8")
        (root / "kept.txt").write_text("keep\n", encoding="utf-8")
        _git(root, "add", "gone.txt", "kept.txt")
        _git(root, "commit", "-m", "add")
        mid = _git(root, "rev-parse", "HEAD")
        (root / "gone.txt").unlink()
        (root / "kept.txt").write_text("keep2\n", encoding="utf-8")
        _git(root, "add", "-A")
        _git(root, "commit", "-m", "delete")
        head = _git(root, "rev-parse", "HEAD")
        diff = MODULE.inspect_phase_diff(root, mid, head)
        self.assertEqual(diff["deletedPaths"], ["gone.txt"])
        self.assertEqual(diff["existingPaths"], ["kept.txt"])
        self.assertNotIn("gone.txt", diff["pathDigests"])

        renamed = _init_repo()
        (renamed / "old.txt").write_text("same-bytes-for-rename\n", encoding="utf-8")
        _git(renamed, "add", "old.txt")
        _git(renamed, "commit", "-m", "old")
        rename_base = _git(renamed, "rev-parse", "HEAD")
        _git(renamed, "mv", "old.txt", "new.txt")
        _git(renamed, "commit", "-m", "rename")
        rename_head = _git(renamed, "rev-parse", "HEAD")
        with self.assertRaises(MODULE.PhaseIdentityError) as caught:
            MODULE.inspect_phase_diff(renamed, rename_base, rename_head)
        self.assertEqual(str(caught.exception), "unresolved_rename")

        linked = _init_repo()
        gitlink_base = _git(linked, "rev-parse", "HEAD")
        _git(
            linked,
            "update-index",
            "--add",
            "--cacheinfo",
            "160000",
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "vendor/lib",
        )
        _git(linked, "commit", "-m", "gitlink")
        gitlink_head = _git(linked, "rev-parse", "HEAD")
        with self.assertRaises(MODULE.PhaseIdentityError) as gitlink_caught:
            MODULE.inspect_phase_diff(linked, gitlink_base, gitlink_head)
        self.assertEqual(str(gitlink_caught.exception), "submodule")
        self.assertNotEqual(base, head)

    def test_repository_scanner_cannot_escape_exact_scope(self) -> None:
        result = MODULE.validate_phase(
            root=ROOT,
            profile="full",
            changed=[".github/openclaw_progressive_validation.py"],
            scanner=lambda _root, paths: {
                "ok": True,
                "findings": [],
                "scannedPaths": [*paths, "src/index.ts"],
            },
            write_evidence_file=False,
        )
        self.assertFalse(result["ok"])
        self.assertIn("scanner_escaped_scope", result["errors"])

        hook = MODULE.validate_phase(
            root=ROOT,
            profile="fast",
            changed=[".github/linktrend-gitops-consumer.json"],
            scanner=lambda _root, paths: {
                "ok": True,
                "findings": [
                    {
                        "kind": "credential",
                        "path": ".github/linktrend-repository-secret-scanners.json",
                        "rule": "repository.scanner",
                    }
                ],
                "scannedPaths": list(paths),
            },
            write_evidence_file=False,
        )
        self.assertFalse(hook["ok"])
        self.assertIn("scanner_escaped_scope", hook["errors"])

    def test_relevant_test_plan_rejects_broadening(self) -> None:
        self.assertTrue(
            MODULE.test_plan_is_broad(
                "[test] warning: broad local run will start 88 Vitest shards",
                OCP01_PATHS,
            )
        )
        self.assertFalse(
            MODULE.test_plan_is_broad(
                "\n".join(
                    [
                        "src/plugin-sdk/agent-harness-runtime.test.ts",
                        "src/agents/failover/classify.test.ts",
                        "extensions/codex/src/app-server/event-projector.terminal-errors.test.ts",
                    ]
                ),
                OCP01_PATHS,
            )
        )

    def test_receipt_evidence_binding_fields_are_present(self) -> None:
        result = MODULE.validate_phase(
            root=ROOT,
            profile="fast",
            baseline=OCP01_BASE,
            head=OCP01_HEAD,
            scanner=_ok_scan,
            execute_tests=False,
            write_evidence_file=False,
        )
        evidence = result["evidence"]
        for key in (
            "baselineCommit",
            "baselineTree",
            "headCommit",
            "headTree",
            "normalizedDiff",
            "normalizedDiffDigest",
            "requestedPaths",
            "scannedExistingPaths",
            "deletedPaths",
            "approvedTestPlan",
            "selectedTestPlan",
            "selectedTestResults",
            "workflow",
            "run",
            "attempt",
            "profile",
            "untouchedUpstreamEvaluated",
        ):
            self.assertIn(key, evidence)
        self.assertFalse(evidence["untouchedUpstreamEvaluated"])
        self.assertEqual(evidence["requestedPaths"], list(OCP01_PATHS))
        self.assertIsNone(evidence.get("approvedTestPlan"))
        self.assertEqual(evidence["selectedTestResults"]["mode"], "not-run")

    def test_real_path_scoped_scan_of_admitted_consumer_map(self) -> None:
        from scripts.gitops import secret_scan

        admitted = [".github/linktrend-gitops-consumer.json"]
        with patch.object(
            secret_scan,
            "_run_repository_scanners",
            side_effect=AssertionError("scoped scan launched repository hook"),
        ) as hook:
            result = secret_scan.scan_repository(ROOT, paths=admitted)
        hook.assert_not_called()
        self.assertNotIn("src/index.ts", result.get("scannedPaths") or admitted)
        findings = [row for row in result["findings"] if row.get("path") not in admitted]
        self.assertEqual(findings, [])
        live = MODULE.validate_phase(
            root=ROOT,
            profile="fast",
            changed=admitted,
            write_evidence_file=False,
        )
        self.assertTrue(live["ok"], live)
        self.assertEqual(live["admittedPaths"], admitted)

    def test_malformed_scan_output_blocks(self) -> None:
        result = MODULE.validate_phase(
            root=ROOT,
            profile="fast",
            changed=[".github/linktrend-gitops-consumer.json"],
            scanner=lambda _root, paths: "not-a-mapping",
            write_evidence_file=False,
        )
        self.assertFalse(result["ok"])
        self.assertIn("scanner-error", result["errors"])

    def _completed(self, code: int, stdout: str = "", stderr: str = "") -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(args=[], returncode=code, stdout=stdout, stderr=stderr)

    def test_broad_unresolved_and_empty_code_plans_are_rejected_before_tests(self) -> None:
        common = {
            "schemaVersion": 1,
            "kind": "customization-test-target-plan",
            "changedPaths": list(OCP01_PATHS),
            "changedPathsDigest": MODULE.canonical_digest(list(OCP01_PATHS)),
            "baselineCommit": OCP01_BASE,
            "headCommit": OCP01_HEAD,
            "nonVitestValidations": [],
        }
        cases = [
            (
                {**common, "mode": "broad", "targets": [], "skippedBroadFallbackPaths": []},
                "relevant_tests_broadened",
            ),
            (
                {
                    **common,
                    "mode": "targets",
                    "targets": [],
                    "skippedBroadFallbackPaths": ["src/index.ts"],
                },
                "relevant_tests_broadened",
            ),
            (
                {**common, "mode": "targets", "targets": [], "skippedBroadFallbackPaths": []},
                "relevant_tests_unresolved",
            ),
        ]
        for payload, error in cases:
            test_calls: list[list[str]] = []

            def planner(
                _cmd: list[str],
                body: dict[str, object] = payload,
            ) -> subprocess.CompletedProcess[str]:
                return self._completed(0, json.dumps(body))

            def tests(cmd: list[str]) -> subprocess.CompletedProcess[str]:
                test_calls.append(list(cmd))
                return self._completed(0, "full suite")

            result = MODULE.validate_phase(
                root=ROOT,
                profile="full",
                baseline=OCP01_BASE,
                head=OCP01_HEAD,
                scanner=_ok_scan,
                execute_tests=True,
                write_evidence_file=False,
                planner_runner=planner,
                test_runner=tests,
            )
            self.assertFalse(result["ok"], result)
            self.assertEqual(result["hold"], MODULE.HOLD_TESTS)
            self.assertIn(error, result["errors"])
            self.assertEqual(test_calls, [])

        failed_calls: list[list[str]] = []

        def failing_planner(_cmd: list[str]) -> subprocess.CompletedProcess[str]:
            return self._completed(1, "", "relevant_tests_broadened")

        def tests_after_fail(cmd: list[str]) -> subprocess.CompletedProcess[str]:
            failed_calls.append(list(cmd))
            return self._completed(0)

        failed = MODULE.validate_phase(
            root=ROOT,
            profile="full",
            baseline=OCP01_BASE,
            head=OCP01_HEAD,
            scanner=_ok_scan,
            execute_tests=True,
            write_evidence_file=False,
            planner_runner=failing_planner,
            test_runner=tests_after_fail,
        )
        self.assertFalse(failed["ok"])
        self.assertIn("relevant_tests_broadened", failed["errors"])
        self.assertEqual(failed_calls, [])

    def test_explicit_target_execution_cannot_become_full_suite(self) -> None:
        plan = {
            "schemaVersion": 1,
            "kind": "customization-test-target-plan",
            "mode": "targets",
            "targets": [
                "src/plugin-sdk/agent-harness-runtime.test.ts",
                "src/agents/failover/classify.test.ts",
            ],
            "skippedBroadFallbackPaths": [],
            "changedPaths": list(OCP01_PATHS),
            "changedPathsDigest": MODULE.canonical_digest(list(OCP01_PATHS)),
            "baselineCommit": OCP01_BASE,
            "headCommit": OCP01_HEAD,
            "nonVitestValidations": [],
        }
        recorded: list[list[str]] = []

        def planner(cmd: list[str]) -> subprocess.CompletedProcess[str]:
            self.assertEqual(cmd[:4], list(MODULE.PLANNER))
            self.assertEqual(cmd[4:], ["--base", OCP01_BASE, "--head", OCP01_HEAD])
            self.assertNotIn("--changed", cmd)
            return self._completed(0, json.dumps(plan))

        def tests(cmd: list[str]) -> subprocess.CompletedProcess[str]:
            recorded.append(list(cmd))
            self.assertEqual(cmd[:4], list(MODULE.TEST_PROJECTS))
            self.assertEqual(cmd[4:], plan["targets"])
            self.assertNotIn("--changed", cmd)
            self.assertGreater(len(cmd), len(MODULE.TEST_PROJECTS))
            return self._completed(0, "\n".join(plan["targets"]))

        result = MODULE.validate_phase(
            root=ROOT,
            profile="full",
            baseline=OCP01_BASE,
            head=OCP01_HEAD,
            scanner=_ok_scan,
            execute_tests=True,
            write_evidence_file=False,
            planner_runner=planner,
            test_runner=tests,
        )
        self.assertTrue(result["ok"], result)
        self.assertEqual(len(recorded), 1)
        self.assertEqual(result["evidence"]["approvedTestPlan"]["targets"], plan["targets"])
        self.assertEqual(result["evidence"]["selectedTestResults"]["command"], recorded[0])
        self.assertFalse(result["evidence"]["selectedTestResults"]["broadFallback"])
        self.assertIsNotNone(result["evidence"]["selectedTestResults"]["runOutputDigest"])

    def test_planner_identity_and_changed_paths_are_bound_before_tests(self) -> None:
        valid = {
            "schemaVersion": 1,
            "kind": "customization-test-target-plan",
            "mode": "targets",
            "targets": ["src/plugin-sdk/agent-harness-runtime.test.ts"],
            "skippedBroadFallbackPaths": [],
            "changedPaths": list(OCP01_PATHS),
            "changedPathsDigest": MODULE.canonical_digest(list(OCP01_PATHS)),
            "baselineCommit": OCP01_BASE,
            "headCommit": OCP01_HEAD,
            "nonVitestValidations": [],
        }
        cases = []
        wrong_identity = dict(valid, baselineCommit="0" * 40, headCommit="1" * 40)
        cases.append(wrong_identity)
        wrong_paths = dict(valid, changedPaths=["src/index.ts"])
        wrong_paths["changedPathsDigest"] = MODULE.canonical_digest(wrong_paths["changedPaths"])
        cases.append(wrong_paths)
        missing_target = dict(valid, targets=["src/does-not-exist.test.ts"])
        cases.append(missing_target)

        for payload in cases:
            test_calls: list[list[str]] = []
            result = MODULE.validate_phase(
                root=ROOT,
                profile="full",
                baseline=OCP01_BASE,
                head=OCP01_HEAD,
                scanner=_ok_scan,
                execute_tests=True,
                write_evidence_file=False,
                planner_runner=lambda _cmd, body=payload: self._completed(0, json.dumps(body)),
                test_runner=lambda cmd: test_calls.append(list(cmd)) or self._completed(0),
            )
            self.assertFalse(result["ok"], result)
            self.assertEqual(test_calls, [])

    def test_non_vitest_validation_map_is_exact(self) -> None:
        changed = [".linktrend/openclaw-prime/customization-boundary.json"]
        payload = {
            "schemaVersion": 1,
            "kind": "customization-test-target-plan",
            "mode": "targets",
            "targets": [],
            "skippedBroadFallbackPaths": [],
            "changedPaths": changed,
            "changedPathsDigest": MODULE.canonical_digest(changed),
            "baselineCommit": OCP01_BASE,
            "headCommit": OCP01_HEAD,
            "nonVitestValidations": [
                {
                    "path": changed[0],
                    "validation": "customization-boundary-validator",
                }
            ],
        }
        accepted = MODULE.validate_planner_payload(
            payload,
            changed,
            OCP01_BASE,
            OCP01_HEAD,
            ROOT,
        )
        self.assertEqual(accepted["nonVitestValidations"], payload["nonVitestValidations"])
        broken = dict(payload, nonVitestValidations=[])
        with self.assertRaisesRegex(RuntimeError, "relevant_tests_unresolved"):
            MODULE.validate_planner_payload(
                broken,
                changed,
                OCP01_BASE,
                OCP01_HEAD,
                ROOT,
            )

    def test_focused_validation_can_cover_custom_code_without_upstream_test_targets(self) -> None:
        changed = [".linktrend/openclaw-prime/resolve_customization_tests.mts"]
        payload = {
            "schemaVersion": 1,
            "kind": "customization-test-target-plan",
            "mode": "targets",
            "targets": [],
            "skippedBroadFallbackPaths": [],
            "changedPaths": changed,
            "changedPathsDigest": MODULE.canonical_digest(changed),
            "baselineCommit": OCP01_BASE,
            "headCommit": OCP01_HEAD,
            "nonVitestValidations": [
                {"path": changed[0], "validation": "progressive-validation-tests"}
            ],
        }
        accepted = MODULE.validate_planner_payload(
            payload,
            changed,
            OCP01_BASE,
            OCP01_HEAD,
            ROOT,
        )
        self.assertEqual(accepted["targets"], [])

    def _native_planner(self) -> list[str]:
        return [
            "node",
            "--experimental-strip-types",
            ".linktrend/openclaw-prime/resolve_customization_tests.mts",
        ]

    def _run_native_planner_for_paths(self, files: dict[str, str]) -> subprocess.CompletedProcess[str]:
        repo = Path(tempfile.mkdtemp(prefix="planner-native-"))
        repo.rmdir()
        try:
            _git(ROOT, "worktree", "add", "--detach", str(repo), "HEAD")
            for rel, content in files.items():
                destination = repo / rel
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_text(content, encoding="utf-8")
                _git(repo, "add", "--", rel)
            _git(repo, "commit", "-m", "planner native probe")
            baseline = _git(repo, "rev-parse", "HEAD~1")
            head = _git(repo, "rev-parse", "HEAD")
            env = os.environ.copy()
            for git_env in (
                "GIT_DIR",
                "GIT_WORK_TREE",
                "GIT_INDEX_FILE",
                "GIT_OBJECT_DIRECTORY",
                "GIT_ALTERNATE_OBJECT_DIRECTORIES",
                "GIT_COMMON_DIR",
                "NODE_OPTIONS",
            ):
                env.pop(git_env, None)
            return subprocess.run(
                [*self._native_planner(), "--base", baseline, "--head", head],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
                env=env,
            )
        finally:
            subprocess.run(
                ["git", "worktree", "remove", "--force", str(repo)],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )

    def test_pkt04_source_only_planning_doc_stays_narrow_non_vitest(self) -> None:
        pkt04 = "linkbots/lisa/docs/LISA-MODEL-ROUTING-EVAL-PKT04-2026-09-11.md"
        planner_source = (ROOT / ".linktrend/openclaw-prime/resolve_customization_tests.mts").read_text(
            encoding="utf-8"
        )
        self.assertIn(f'["{pkt04}", "phase-diff-check"]', planner_source)
        self.assertNotIn('["linkbots/lisa/docs", "phase-diff-check"]', planner_source)
        self.assertNotIn("LISA-MODEL-ROUTING-EVAL-PKT04-2026-09-11.md*", planner_source)
        self.assertNotIn('from "../../scripts/test-projects.test-support.mts"', planner_source)
        self.assertIn('await import(TARGET_PLAN_RESOLVER)', planner_source)
        self.assertNotIn("tsx.mjs", planner_source)
        self.assertNotIn("./scripts/tsx.mjs", self._native_planner())
        self.assertEqual(self._native_planner()[0], "node")
        self.assertEqual(
            self._native_planner()[-1],
            ".linktrend/openclaw-prime/resolve_customization_tests.mts",
        )

        executed = self._run_native_planner_for_paths({pkt04: "# PKT-04 planning document\n"})
        self.assertNotIn("tsx/esm", executed.stderr)
        self.assertNotIn("Cannot find module 'tsx/esm'", executed.stderr)
        self.assertNotIn("relevant_tests_broadened", executed.stderr)
        self.assertEqual(executed.returncode, 0, executed.stderr)
        payload = json.loads(executed.stdout)
        self.assertEqual(payload["mode"], "targets")
        self.assertEqual(payload["targets"], [])
        self.assertEqual(payload["skippedBroadFallbackPaths"], [])
        self.assertEqual(payload["changedPaths"], [pkt04])
        self.assertEqual(
            payload["nonVitestValidations"],
            [{"path": pkt04, "validation": "phase-diff-check"}],
        )
        self.assertEqual(payload["changedPathsDigest"], MODULE.canonical_digest([pkt04]))
        self.assertEqual(MODULE.NON_VITEST_VALIDATION[pkt04], "phase-diff-check")
        accepted = MODULE.validate_planner_payload(
            payload,
            [pkt04],
            payload["baselineCommit"],
            payload["headCommit"],
            ROOT,
        )
        self.assertEqual(
            accepted["nonVitestValidations"],
            [{"path": pkt04, "validation": "phase-diff-check"}],
        )

    def test_unmapped_code_still_loads_or_fail_closes_test_targets(self) -> None:
        unmapped = "unmapped-fast-ci-probe.ts"
        self.assertNotIn(unmapped, MODULE.NON_VITEST_VALIDATION)
        executed = self._run_native_planner_for_paths({unmapped: "export const probe = 1;\n"})
        self.assertNotEqual(executed.returncode, 0, executed.stdout)
        combined = executed.stdout + executed.stderr
        self.assertIn('"ok":false', combined.replace(" ", ""))
        self.assertTrue(
            "relevant_tests_unresolved" in combined or "relevant_tests_broadened" in combined,
            combined,
        )
        self.assertNotIn("tsx/esm", executed.stderr)
        if "relevant_tests_broadened" in combined:
            self.assertIn(unmapped, combined)

    def test_phase_packager_history_registry_uses_unittest_discovery(self) -> None:
        command = MODULE.non_vitest_command(
            "phase-packager-history-tests",
            OCP01_BASE,
            OCP01_HEAD,
        )
        discovered = [
            "env",
            "PYTHONPATH=.",
            "python3",
            "-m",
            "unittest",
            "discover",
            "-s",
            "test",
            "-p",
            "packager_coordinator_phase_history.py",
        ]
        imported = [
            "env",
            "PYTHONPATH=.",
            "python3",
            "-m",
            "unittest",
            "test/packager_coordinator_phase_history.py",
        ]
        self.assertEqual(command, discovered)
        self.assertNotEqual(command, imported)

    def test_non_vitest_validations_execute_and_bind_each_declared_path(self) -> None:
        changed = sorted(
            [
                ".linktrend/openclaw-prime/customization-boundary.json",
                "docs/execution/openclaw-prime-lisa/BASELINE-CI-RECEIPT.md",
                "docs/execution/openclaw-prime-lisa/dispatch-authority.json",
                "test/openclaw_progressive_validation.py",
                "test/packager_coordinator_phase_history.py",
            ]
        )
        validations = [
            {"path": path, "validation": MODULE.NON_VITEST_VALIDATION[path]}
            for path in changed
        ]
        plan = {
            "schemaVersion": 1,
            "kind": "customization-test-target-plan",
            "mode": "targets",
            "targets": [],
            "skippedBroadFallbackPaths": [],
            "changedPaths": changed,
            "changedPathsDigest": MODULE.canonical_digest(changed),
            "baselineCommit": OCP01_BASE,
            "headCommit": OCP01_HEAD,
            "nonVitestValidations": validations,
        }
        executed: list[list[str]] = []
        result = MODULE.run_relevant_tests(
            ROOT,
            OCP01_BASE,
            OCP01_HEAD,
            changed,
            execute=True,
            planner_runner=lambda _cmd: self._completed(0, json.dumps(plan)),
            validation_runner=lambda command: executed.append(list(command)) or self._completed(0, "ok"),
        )
        self.assertEqual(len(executed), len({item["validation"] for item in validations}))
        self.assertEqual(len(result["nonVitestResults"]), len(executed))
        bound_paths = sorted(
            path for row in result["nonVitestResults"] for path in row["paths"]
        )
        self.assertEqual(bound_paths, changed)
        diff = next(row for row in result["nonVitestResults"] if row["validation"] == "phase-diff-check")
        self.assertEqual(diff["command"], ["git", "diff", "--check", OCP01_BASE, OCP01_HEAD])
        self.assertTrue(all(row["runOutputDigest"].startswith("sha256:") for row in result["nonVitestResults"]))

    def test_fast_workflow_fetches_only_the_exact_historical_snapshot_commit(self) -> None:
        workflow = (ROOT / ".github/workflows/linktrend-review-packager.yml").read_text(
            encoding="utf-8"
        )
        self.assertIn(
            "HISTORICAL_APPROVAL_COMMIT: 452a7f1f31b1d1947d4bb992f91457e5a238ea31",
            workflow,
        )
        self.assertIn(f"OCP01_BASE: {OCP01_BASE}", workflow)
        self.assertIn(f"OCP01_HEAD: {OCP01_HEAD}", workflow)
        self.assertIn(
            'git fetch --no-tags --depth=1 origin "${HISTORICAL_APPROVAL_COMMIT}"',
            workflow,
        )
        self.assertIn(
            'git fetch --no-tags --depth=8 origin "${OCP01_HEAD}"',
            workflow,
        )
        self.assertIn('git cat-file -e "${OCP01_BASE}^{commit}"', workflow)
        self.assertIn('git merge-base --is-ancestor "${OCP01_BASE}" "${OCP01_HEAD}"', workflow)
        self.assertNotIn("git fetch --unshallow", workflow)
        self.assertNotIn("--deepen", workflow)

    def test_fast_does_not_invoke_node_planner_or_test_runner(self) -> None:
        planner_calls: list[list[str]] = []
        test_calls: list[list[str]] = []

        def planner(cmd: list[str]) -> subprocess.CompletedProcess[str]:
            planner_calls.append(list(cmd))
            return self._completed(0, "{}")

        def tests(cmd: list[str]) -> subprocess.CompletedProcess[str]:
            test_calls.append(list(cmd))
            return self._completed(0)

        result = MODULE.validate_phase(
            root=ROOT,
            profile="fast",
            baseline=OCP01_BASE,
            head=OCP01_HEAD,
            scanner=_ok_scan,
            execute_tests=False,
            write_evidence_file=False,
            planner_runner=planner,
            test_runner=tests,
        )
        self.assertTrue(result["ok"], result)
        self.assertEqual(planner_calls, [])
        self.assertEqual(test_calls, [])


if __name__ == "__main__":
    unittest.main()

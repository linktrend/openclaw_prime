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


def _git(cwd: Path, *args: str) -> str:
    result = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, check=True)
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
        from scripts.gitops.secret_scan import scan_repository

        admitted = [".github/linktrend-gitops-consumer.json"]
        result = scan_repository(ROOT, paths=admitted)
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
        cases = [
            (
                '{"mode":"broad","targets":[],"skippedBroadFallbackPaths":[]}',
                "relevant_tests_broadened",
            ),
            (
                '{"mode":"targets","targets":[],"skippedBroadFallbackPaths":["src/index.ts"]}',
                "relevant_tests_broadened",
            ),
            (
                '{"mode":"targets","targets":[],"skippedBroadFallbackPaths":[]}',
                "relevant_tests_unresolved",
            ),
        ]
        for stdout, error in cases:
            test_calls: list[list[str]] = []

            def planner(_cmd: list[str], payload: str = stdout) -> subprocess.CompletedProcess[str]:
                return self._completed(0, payload)

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

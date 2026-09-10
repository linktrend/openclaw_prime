"""Focused tests for customization-scoped Fast/Full validation."""

from __future__ import annotations

import json
import unittest
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / ".github" / "openclaw_progressive_validation.py"
SPEC = spec_from_file_location("openclaw_progressive_validation", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

ROOT = Path(__file__).resolve().parents[1]


def _ok_scan(_root: Path, paths: list[str] | tuple[str, ...]) -> dict[str, object]:
    return {"ok": True, "findings": [], "scannedPaths": list(paths)}


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

    def test_customization_paths_are_admitted(self) -> None:
        recorded: list[str] = []

        def scanner(_root: Path, paths: list[str] | tuple[str, ...]) -> dict[str, object]:
            recorded.extend(paths)
            return _ok_scan(_root, paths)

        result = MODULE.validate_phase(
            root=ROOT,
            profile="fast",
            changed=[
                ".linktrend/openclaw-prime/customization-boundary.json",
                "scripts/gitops/secret_scan.py",
                ".github/linktrend-gitops-consumer.json",
                "docs/execution/openclaw-prime-lisa/IMPLEMENTATION-ROADMAP.md",
                "test/openclaw_progressive_validation.py",
            ],
            scanner=scanner,
        )
        self.assertTrue(result["ok"], result)
        self.assertEqual(result["excludedPaths"], [])
        self.assertIn(".linktrend/openclaw-prime/customization-boundary.json", result["admittedPaths"])
        self.assertIn("test/openclaw_progressive_validation.py", result["admittedPaths"])
        self.assertEqual(sorted(recorded), result["admittedPaths"])
        self.assertFalse(result["requireOwnFullWorkflow"])

    def test_upstream_src_extensions_and_test_paths_block(self) -> None:
        recorded: list[str] = []

        def scanner(_root: Path, paths: list[str] | tuple[str, ...]) -> dict[str, object]:
            recorded.extend(paths)
            return _ok_scan(_root, paths)

        result = MODULE.validate_phase(
            root=ROOT,
            profile="full",
            changed=[
                "src/index.ts",
                "extensions/telegram/src/index.ts",
                "test/helpers/fixture.ts",
            ],
            scanner=scanner,
        )
        self.assertFalse(result["ok"])
        self.assertEqual(result["hold"], MODULE.HOLD_UPSTREAM)
        self.assertEqual(
            result["excludedPaths"],
            [
                "extensions/telegram/src/index.ts",
                "src/index.ts",
                "test/helpers/fixture.ts",
            ],
        )
        self.assertEqual(recorded, [])

    def test_path_scoped_secret_and_skipped_inputs_block(self) -> None:
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
        )
        self.assertFalse(skipped["ok"])
        self.assertEqual(skipped["hold"], MODULE.HOLD_SCAN)
        self.assertIn("new-skipped-input", skipped["errors"])

    def test_only_admitted_files_are_scanned(self) -> None:
        recorded: list[str] = []

        def scanner(_root: Path, paths: list[str] | tuple[str, ...]) -> dict[str, object]:
            recorded.extend(paths)
            return {
                "ok": True,
                "findings": [],
                "scannedPaths": [*paths, "src/index.ts"],
            }

        result = MODULE.validate_phase(
            root=ROOT,
            profile="full",
            changed=[".github/openclaw_progressive_validation.py"],
            scanner=scanner,
        )
        self.assertFalse(result["ok"])
        self.assertEqual(recorded, [".github/openclaw_progressive_validation.py"])
        self.assertIn("scanner_escaped_scope", result["errors"])

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
        )
        self.assertTrue(live["ok"], live)
        self.assertEqual(live["admittedPaths"], admitted)


if __name__ == "__main__":
    unittest.main()

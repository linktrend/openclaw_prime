"""Focused tests for the OpenClaw Prime execution-approval snapshot."""

from __future__ import annotations

import copy
import hashlib
import json
import sys
import unittest
from pathlib import Path

DOCS = Path(__file__).resolve().parents[1]
if str(DOCS) not in sys.path:
    sys.path.insert(0, str(DOCS))

from validate_execution_approval_snapshot import (  # noqa: E402
    AUTHORIZED_DEVELOPMENT_COMMIT,
    AUTHORIZED_DEVELOPMENT_TREE,
    FROZEN_AUTHORITY_SHA256,
    VALIDATION_POLICY_DIGEST,
    SnapshotError,
    load_json,
    sha256_file,
    validate_files,
    validate_snapshot,
)


class ExecutionApprovalSnapshotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.snapshot = validate_files()

    def test_binds_exact_protected_development(self) -> None:
        identity = self.snapshot["approvedProtectedDevelopment"]
        self.assertEqual(identity["commit"], AUTHORIZED_DEVELOPMENT_COMMIT)
        self.assertEqual(identity["tree"], AUTHORIZED_DEVELOPMENT_TREE)
        self.assertEqual(identity["ref"], "development")
        self.assertEqual(identity["repository"], "linktrend/openclaw_prime")

    def test_principal_policy_is_grok_primary_luna_fallback(self) -> None:
        policy = self.snapshot["principalPolicy"]
        self.assertEqual(policy["primaryExecutor"]["modelId"], "cursor-grok-4.6-medium")
        self.assertEqual(policy["primaryExecutor"]["transport"], "cursor-sdk")
        self.assertFalse(policy["primaryExecutor"]["fast"])
        fallback = policy["fallbackOrConcurrentExecutor"]
        self.assertEqual(fallback["modelId"], "gpt-5.6-luna")
        self.assertEqual(fallback["reasoning"], "high")
        self.assertEqual(fallback["transport"], "codex-cli")
        self.assertFalse(policy["duplicateImplementation"])
        self.assertEqual(policy["parallelism"]["admissionWithoutCapacitySnapshot"], "HOLD")

    def test_only_pkt01_is_dispatch_authorized(self) -> None:
        authorized = [
            packet_id
            for packet_id, item in self.snapshot["packets"].items()
            if item["dispatchAuthorized"]
        ]
        self.assertEqual(authorized, ["PKT-01"])
        self.assertFalse(self.snapshot["packets"]["PKT-01"]["workerIssueAuthorized"])
        self.assertFalse(self.snapshot["packets"]["PKT-04"]["dispatchAuthorized"])
        self.assertTrue(self.snapshot["packets"]["PKT-04"]["dependencyReady"])
        self.assertFalse(self.snapshot["workerIssueAuthorized"])

    def test_runtime_and_external_prerequisites_fail_closed(self) -> None:
        runtime = self.snapshot["runtimeAuthority"]
        self.assertTrue(runtime["failClosed"])
        self.assertFalse(runtime["packetTokenBudgetsPresent"])
        for state in self.snapshot["externalPrerequisites"].values():
            self.assertFalse(state["receiptPresent"])
            self.assertEqual(state["checkpointState"], "PENDING_RUNTIME_EVIDENCE")

    def test_frozen_authority_digest_matches_bytes(self) -> None:
        path = DOCS / "dispatch-authority.json"
        self.assertEqual(
            self.snapshot["frozenDispatchAuthority"]["sha256"],
            sha256_file(path),
        )
        self.assertFalse(self.snapshot["frozenDispatchAuthority"]["rewrittenByThisSnapshot"])

    def test_schema_kind_is_closed(self) -> None:
        schema = load_json(DOCS / "execution-approval-snapshot.schema.json")
        self.assertEqual(
            schema["properties"]["kind"]["const"],
            "openclaw-prime-lisa-execution-approval-snapshot",
        )

    def test_validation_policy_digest_is_canonical(self) -> None:
        authority = load_json(DOCS / "dispatch-authority.json")
        policy = authority["validationPolicy"]
        payload = {key: value for key, value in policy.items() if key != "digest"}
        computed = "sha256:" + hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        self.assertEqual(policy["digest"], VALIDATION_POLICY_DIGEST)
        self.assertEqual(computed, VALIDATION_POLICY_DIGEST)
        self.assertEqual(
            policy["phaseValidation"]["customizationScope"],
            "exact-normalized-protected-base-to-phase-diff",
        )
        self.assertFalse(policy["phaseValidation"]["staticProvenanceExcludesProvenPhasePath"])
        self.assertEqual(self.snapshot["frozenDispatchAuthority"]["sha256"], FROZEN_AUTHORITY_SHA256)
        self.assertEqual(self.snapshot["frozenDispatchAuthority"]["sha256"], sha256_file(DOCS / "dispatch-authority.json"))

    def test_reject_authorizing_non_customization_packet(self) -> None:
        broken = copy.deepcopy(self.snapshot)
        broken["packets"]["PKT-04"]["dispatchAuthorized"] = True
        with self.assertRaises(SnapshotError):
            validate_snapshot(broken)

    def test_reject_invented_external_receipt(self) -> None:
        broken = copy.deepcopy(self.snapshot)
        broken["externalPrerequisites"]["platform_contract_accepted"]["receiptPresent"] = True
        with self.assertRaises(SnapshotError):
            validate_snapshot(broken)


if __name__ == "__main__":
    unittest.main()

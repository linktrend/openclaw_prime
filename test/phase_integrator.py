"""Phase-local Candidate ID remains distinct from schema-v2 receipt identity."""

from __future__ import annotations

import hashlib
import json
import unittest

from scripts.gitops.coordinator import receipts
from scripts.gitops.coordinator.state import CandidateIdentity, comparable_sealed_identity
from scripts.gitops.phase_integrator import _digest_set, candidate_identity_for
from scripts.gitops.receipt_seal import bind_full_receipt_identity

RUN_HEAD = "af11a824d348836791972003d53c8178253779e8"
RUN_TREE = "a26304573fd89c9cc1eca55d8524efc31d2b8333"
RUN_REPO = "linktrend/openclaw_prime"
RUN_BRANCH = "phase/315-fork-scoped-validation-20260911"
DEP_DIGEST = "sha256:715669b6894789f736958ebc7cc70c9fe25b4ee509cccc38d0908dcd1c6268af"
PROFILE_DIGEST = "sha256:b0dc255dce28464d025ee62834435a21015b740782f10e04f9a04df0fd09266c"
WORKFLOW_DIGEST = "sha256:0fee95d2beea792d7ff54e84d98b6c6cc72cbea967a766a4ad28c51be4e0a2cd"
COMMAND_DIGEST = "sha256:38a64e1be8a32c5ed7abc74ce030e1cba91abc5dbb21e608ce71223b59ccb571"
EVIDENCE_DIGEST = "sha256:" + ("b" * 64)


def _v2_identity() -> dict[str, str]:
    return {
        "repository": RUN_REPO,
        "sourceBranch": RUN_BRANCH,
        "headCommit": RUN_HEAD,
        "gitTree": RUN_TREE,
        "dependencyDigest": DEP_DIGEST,
        "profileDigest": PROFILE_DIGEST,
        "workflowDigest": WORKFLOW_DIGEST,
    }


def _complete_receipt() -> dict[str, object]:
    payload: dict[str, object] = {
        "schemaVersion": 2,
        "candidateIdentity": _v2_identity(),
        "workflowRunId": 34617569821,
        "workflowRunAttempt": 1,
        "runnerLabel": "ubuntu-24.04-arm",
        "startedAt": "2026-09-11T15:41:04Z",
        "completedAt": "2026-09-11T15:45:10Z",
        "conclusion": "success",
        "commandDigest": COMMAND_DIGEST,
        "evidenceDigests": {"full-suite-summary.txt": EVIDENCE_DIGEST},
    }
    return receipts.create_full_suite_receipt(payload).to_dict()


class PhaseLocalCandidateIdTests(unittest.TestCase):
    def test_sealed_candidate_id_stays_phase_local_and_binds_full_receipt(self) -> None:
        identity = candidate_identity_for(
            repository=RUN_REPO,
            source_sha=RUN_HEAD,
            git_tree_sha=RUN_TREE,
            dependency_digests={"pnpm-lock.yaml": DEP_DIGEST},
            test_profile="full",
        )
        self.assertIsInstance(identity, CandidateIdentity)
        self.assertEqual(identity.test_profile, "full")
        phase_id = "sha256:" + _digest_set(identity)
        v2_digest = "sha256:" + hashlib.sha256(
            json.dumps(_v2_identity(), sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        self.assertNotEqual(phase_id, v2_digest)

        projected = comparable_sealed_identity(identity.to_dict())
        self.assertEqual(projected["repository"], RUN_REPO)
        self.assertEqual(projected["headCommit"], RUN_HEAD)
        self.assertEqual(projected["gitTree"], RUN_TREE)
        self.assertEqual(projected["testProfile"], "full")
        self.assertIsNone(projected["profileDigest"])

        record = {
            "sealed": True,
            "sealedSha": RUN_HEAD,
            "headSha": RUN_HEAD,
            "repository": RUN_REPO,
            "candidateId": phase_id,
            "candidateIdentity": identity.to_dict(),
        }
        receipt = _complete_receipt()
        self.assertNotIn("candidateId", receipt)
        bound = bind_full_receipt_identity(record, receipt, live_head_sha=RUN_HEAD, expected_tree=RUN_TREE)
        self.assertTrue(bound["accepted"], bound)
        self.assertEqual(bound["candidateId"], phase_id)
        self.assertEqual(bound["profileDigest"], PROFILE_DIGEST)


if __name__ == "__main__":
    unittest.main()

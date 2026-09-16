"""Focused Full receipt identity adapter binding tests."""

from __future__ import annotations

import hashlib
import json
import unittest

from scripts.gitops.coordinator import receipts
from scripts.gitops.coordinator.state import CandidateIdentity as PhaseIdentity
from scripts.gitops.phase_integrator import _digest_set, candidate_identity_for
from scripts.gitops.receipt_seal import bind_full_receipt_identity, phase_merge_eligibility_with_receipt

RUN_HEAD = "af11a824d348836791972003d53c8178253779e8"
RUN_TREE = "a26304573fd89c9cc1eca55d8524efc31d2b8333"
RUN_REPO = "linktrend/openclaw_prime"
RUN_BRANCH = "phase/315-fork-scoped-validation-20260911"
DEP_DIGEST = "sha256:715669b6894789f736958ebc7cc70c9fe25b4ee509cccc38d0908dcd1c6268af"
PROFILE_DIGEST = "sha256:b0dc255dce28464d025ee62834435a21015b740782f10e04f9a04df0fd09266c"
WORKFLOW_DIGEST = "sha256:0fee95d2beea792d7ff54e84d98b6c6cc72cbea967a766a4ad28c51be4e0a2cd"
COMMAND_DIGEST = "sha256:38a64e1be8a32c5ed7abc74ce030e1cba91abc5dbb21e608ce71223b59ccb571"
EVIDENCE_DIGEST = "sha256:" + ("b" * 64)


def _v2_identity(**changes: str) -> dict[str, str]:
    value = {
        "repository": RUN_REPO,
        "sourceBranch": RUN_BRANCH,
        "headCommit": RUN_HEAD,
        "gitTree": RUN_TREE,
        "dependencyDigest": DEP_DIGEST,
        "profileDigest": PROFILE_DIGEST,
        "workflowDigest": WORKFLOW_DIGEST,
    }
    value.update(changes)
    return value


def _complete_receipt(**changes: object) -> dict[str, object]:
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
    payload.update(changes)
    return receipts.create_full_suite_receipt(payload).to_dict()


def _phase_record(**identity_changes: object) -> dict[str, object]:
    identity = {
        "repository": RUN_REPO,
        "sourceSha": RUN_HEAD,
        "gitTreeSha": RUN_TREE,
        "dependencyDigests": {"pnpm-lock.yaml": DEP_DIGEST},
        "testProfile": "full",
    }
    identity.update(identity_changes)
    phase_identity = PhaseIdentity.from_dict(identity)
    return {
        "sealed": True,
        "sealedSha": RUN_HEAD,
        "headSha": RUN_HEAD,
        "repository": RUN_REPO,
        "candidateId": "sha256:" + _digest_set(phase_identity),
        "candidateIdentity": phase_identity.to_dict(),
        "fast": {"status": "passed", "sha": RUN_HEAD},
        "bugbot": {"status": "passed", "sha": RUN_HEAD},
        "full": {"status": "passed", "sha": RUN_HEAD},
    }


def _schema_v2_identity_digest(identity: dict[str, str]) -> str:
    canonical = json.dumps(identity, sort_keys=True, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class FullReceiptIdentityAdapterTests(unittest.TestCase):
    def test_exact_successful_run_identity_binds_without_candidate_id_or_profile_field(self) -> None:
        receipt = _complete_receipt()
        self.assertNotIn("candidateId", receipt)
        self.assertNotIn("profile", receipt)
        self.assertNotIn("profile", receipt["candidateIdentity"])
        record = _phase_record()
        v2_digest = _schema_v2_identity_digest(receipt["candidateIdentity"])
        self.assertNotEqual(record["candidateId"], v2_digest)

        bound = bind_full_receipt_identity(record, receipt, live_head_sha=RUN_HEAD, expected_tree=RUN_TREE)
        self.assertTrue(bound["accepted"], bound)
        self.assertEqual(bound["code"], "bound")
        self.assertEqual(bound["candidateId"], record["candidateId"])
        self.assertEqual(bound["repository"], RUN_REPO)
        self.assertEqual(bound["headCommit"], RUN_HEAD)
        self.assertEqual(bound["gitTree"], RUN_TREE)
        self.assertEqual(bound["profileDigest"], PROFILE_DIGEST)

        eligible = phase_merge_eligibility_with_receipt(
            record, live_head_sha=RUN_HEAD, retained_receipt=receipt, expected_tree=RUN_TREE
        )
        self.assertTrue(eligible.eligible, eligible.detail)

    def test_mismatched_repository_head_tree_and_profile_are_rejected(self) -> None:
        record = _phase_record()
        receipt = _complete_receipt()

        other_repo = _complete_receipt(candidateIdentity=_v2_identity(repository="acme/demo"))
        repo_fail = bind_full_receipt_identity(record, other_repo, live_head_sha=RUN_HEAD, expected_tree=RUN_TREE)
        self.assertFalse(repo_fail["accepted"])
        self.assertEqual(repo_fail["code"], "repository_mismatch")
        self.assertEqual(repo_fail["candidateId"], record["candidateId"])

        other_head = _complete_receipt(candidateIdentity=_v2_identity(headCommit="a" * 40))
        head_fail = bind_full_receipt_identity(record, other_head, live_head_sha=RUN_HEAD, expected_tree=RUN_TREE)
        self.assertFalse(head_fail["accepted"])
        self.assertEqual(head_fail["code"], "retained_receipt_wrong_head")

        other_tree = _complete_receipt(candidateIdentity=_v2_identity(gitTree="b" * 40))
        tree_fail = bind_full_receipt_identity(record, other_tree, live_head_sha=RUN_HEAD, expected_tree=RUN_TREE)
        self.assertFalse(tree_fail["accepted"])
        self.assertEqual(tree_fail["code"], "retained_receipt_wrong_tree")

        fast_record = _phase_record(testProfile="fast")
        profile_fail = bind_full_receipt_identity(
            fast_record, receipt, live_head_sha=RUN_HEAD, expected_tree=RUN_TREE
        )
        self.assertFalse(profile_fail["accepted"])
        self.assertEqual(profile_fail["code"], "profile_mismatch")

        digest_record = dict(record)
        digest_record["candidateIdentity"] = {
            **record["candidateIdentity"],
            "profileDigest": "sha256:" + ("e" * 64),
        }
        digest_fail = bind_full_receipt_identity(
            digest_record, receipt, live_head_sha=RUN_HEAD, expected_tree=RUN_TREE
        )
        self.assertFalse(digest_fail["accepted"])
        self.assertEqual(digest_fail["code"], "profile_mismatch")

    def test_phase_local_candidate_id_is_not_schema_v2_canonical_digest(self) -> None:
        phase = candidate_identity_for(
            repository=RUN_REPO,
            source_sha=RUN_HEAD,
            git_tree_sha=RUN_TREE,
            dependency_digests={"pnpm-lock.yaml": DEP_DIGEST},
            test_profile="full",
        )
        phase_id = "sha256:" + _digest_set(phase)
        v2_digest = _schema_v2_identity_digest(_v2_identity())
        self.assertNotEqual(phase_id, v2_digest)
        record = _phase_record()
        self.assertEqual(record["candidateId"], phase_id)
        bound = bind_full_receipt_identity(
            record, _complete_receipt(), live_head_sha=RUN_HEAD, expected_tree=RUN_TREE
        )
        self.assertTrue(bound["accepted"], bound)
        self.assertEqual(bound["candidateId"], phase_id)


if __name__ == "__main__":
    unittest.main()

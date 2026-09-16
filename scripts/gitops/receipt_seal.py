#!/usr/bin/env python3
"""WP-U06 pre-merge receipt sealing, canonical head resolution, and recovery.

Preserves the existing FullSuiteReceipt schemaVersion 2 identity format from
``coordinator.receipts``.  Never treats GitHub synthetic merge-ref SHAs as
promotable candidate identity.  Never invents empty commits or fake PRs for
legacy recovery.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Mapping, Sequence

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))
if str(SCRIPT_DIR.parent) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR.parent))

from coordinator.receipts import (  # noqa: E402
    CandidateIdentity,
    FullSuiteReceipt,
    ReceiptError,
    create_transition_receipt,
    compute_receipt_digest,
    store_receipt,
    store_transition_receipt,
    verify_receipt,
    verify_transition_receipt,
)
from coordinator.state import StateError, comparable_sealed_identity  # noqa: E402
try:
    from scripts.gitops.phase_integrator import MergeEligibility, phase_merge_eligibility  # noqa: E402
except ModuleNotFoundError:  # pragma: no cover - direct script execution
    from phase_integrator import MergeEligibility, phase_merge_eligibility  # noqa: E402
from receipt_loop_detector import admit_receipt_maintenance_transition, write_loop_diagnosis  # noqa: E402

SHA40 = re.compile(r"^[0-9a-f]{40}$")
DIGEST_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
BRANCH_RE = re.compile(r"^(?!.*(?:^|/)\.\.(?:/|$))[A-Za-z0-9._/-]+$")
MERGE_REF_RE = re.compile(r"^refs/pull/[0-9]+/merge$")


class SealError(Exception):
    def __init__(self, code: str, detail: str = "") -> None:
        self.code = code
        self.detail = detail or code
        super().__init__(self.code if not detail else f"{self.code}:{self.detail}")


class RecoveryError(Exception):
    def __init__(self, code: str, detail: str = "") -> None:
        self.code = code
        self.detail = detail or code
        super().__init__(self.code if not detail else f"{self.code}:{self.detail}")


def issue_transition_receipt(
    source_receipt: Mapping[str, Any] | FullSuiteReceipt,
    *,
    target_branch: str,
    target_commit: str,
    target_tree: str,
    transition_type: str = "protected-merge",
    maintenance_paths: Sequence[str] = (),
    failure_contract_digest: str | None = None,
    protected_base_commit: str | None = None,
    store_repo: str | Path | None = None,
    store_root: str | Path | None = None,
    maintenance_history: Sequence[Mapping[str, Any]] = (),
    authorized_paths: Sequence[str] = (),
    changed_paths: Sequence[str] | None = None,
    current_protected_base: str | None = None,
    expected_protected_base: str | None = None,
    predecessor_failure_contract_digest: str | None = None,
    diagnosis_path: str | Path | None = None,
) -> dict[str, Any]:
    """Issue and optionally retain a digest-bound protected transition."""

    transition = create_transition_receipt(
        source_receipt,
        target_branch=target_branch,
        target_commit=target_commit,
        target_tree=target_tree,
        transition_type=transition_type,
        maintenance_paths=maintenance_paths,
        failure_contract_digest=failure_contract_digest,
        protected_base_commit=protected_base_commit,
    )
    if transition_type == "receipt-maintenance":
        maintenance = admit_receipt_maintenance_transition(
            source_receipt.to_dict() if isinstance(source_receipt, FullSuiteReceipt) else source_receipt,
            transition.to_dict(),
            history=maintenance_history,
            changed_paths=changed_paths,
            authorized_paths=authorized_paths,
            current_protected_base=current_protected_base,
            expected_protected_base=expected_protected_base,
            failure_contract_digest=failure_contract_digest,
            predecessor_failure_contract_digest=predecessor_failure_contract_digest,
        )
        if not maintenance.allowed:
            if diagnosis_path is not None:
                write_loop_diagnosis(diagnosis_path, maintenance, predecessor=source_receipt.to_dict() if isinstance(source_receipt, FullSuiteReceipt) else source_receipt, successor=transition.to_dict())
            raise SealError(maintenance.code, maintenance.detail)
    payload = transition.to_dict()
    if store_repo is not None:
        if isinstance(source_receipt, FullSuiteReceipt):
            store_receipt(source_receipt, repo_path=store_repo, store_root=store_root)
        else:
            from coordinator.receipts import FullSuiteReceipt as _FullSuiteReceipt

            store_receipt(_FullSuiteReceipt.from_dict(source_receipt), repo_path=store_repo, store_root=store_root)
        payload["storePath"] = str(store_transition_receipt(transition, repo_path=store_repo, store_root=store_root))
    return payload


def verify_transition_for_promotion(
    source_receipt: Mapping[str, Any],
    transition_receipt: Mapping[str, Any],
    target_identity: Mapping[str, Any],
    *,
    expected_workflow_run_id: int | None = None,
    expected_workflow_run_attempt: int | None = None,
    expected_base_commit: str | None = None,
) -> dict[str, Any]:
    """Return a promotion-safe decision for a commit-changing same-tree merge."""

    verdict = verify_transition_receipt(
        transition_receipt,
        source_receipt,
        target_identity,
        expected_workflow_run_id=expected_workflow_run_id,
        expected_workflow_run_attempt=expected_workflow_run_attempt,
        expected_base_commit=expected_base_commit,
    )
    return {
        "accepted": bool(verdict),
        "code": verdict.code,
        "detail": verdict.message or verdict.code,
        "sourceCommit": verdict.source_commit,
        "promotionCommit": verdict.promotion_commit,
    }


def _sha(value: Any) -> str:
    text = str(value or "").strip().lower()
    return text if SHA40.fullmatch(text) else ""


def _digest(value: Any) -> str:
    text = str(value or "").strip().lower()
    return text if DIGEST_RE.fullmatch(text) else ""


def _mapping(value: Any) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise SealError("invalid_payload", "expected object")
    return value


def _git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def resolve_canonical_candidate_head(payload: Mapping[str, Any]) -> dict[str, Any]:
    """Resolve the promotable candidate from PR head — never merge-ref identity."""

    data = _mapping(payload)
    pr = data.get("pull_request") if isinstance(data.get("pull_request"), Mapping) else {}
    head_obj = pr.get("head") if isinstance(pr.get("head"), Mapping) else {}
    base_obj = pr.get("base") if isinstance(pr.get("base"), Mapping) else {}

    explicit_branch = str(data.get("source_branch") or data.get("sourceBranch") or "").strip()
    head_ref = str(head_obj.get("ref") or explicit_branch or "").strip()
    if MERGE_REF_RE.fullmatch(explicit_branch) or MERGE_REF_RE.fullmatch(head_ref) or explicit_branch.endswith("/merge"):
        raise SealError("merge_ref_identity_forbidden", "merge-ref cannot identify the candidate")

    candidate_head = _sha(
        data.get("candidate_head")
        or data.get("candidateHead")
        or head_obj.get("sha")
        or data.get("expected_head")
    )
    if "candidate_head" in data or "candidateHead" in data:
        offered = _sha(data.get("candidate_head") or data.get("candidateHead"))
        pr_head = _sha(head_obj.get("sha"))
        merge_sha = _sha(pr.get("merge_commit_sha") or data.get("merge_ref_sha") or data.get("mergeRefSha"))
        if offered and merge_sha and offered == merge_sha and (not pr_head or offered != pr_head):
            raise SealError("merge_ref_identity_forbidden", "offered candidate head is the synthetic merge SHA")

    if not candidate_head:
        raw = head_obj.get("sha") or data.get("candidate_head") or data.get("candidateHead")
        if raw in (None, ""):
            raise SealError("candidate_head_missing", "PR head SHA is required")
        raise SealError("candidate_head_invalid", f"invalid candidate head: {raw!r}")

    if not head_ref or not BRANCH_RE.fullmatch(head_ref) or ".." in head_ref:
        raise SealError("source_branch_invalid", f"invalid source branch: {head_ref!r}")

    candidate_tree = _sha(data.get("candidate_tree") or data.get("candidateTree") or data.get("gitTree"))
    merge_sha = _sha(pr.get("merge_commit_sha") or data.get("merge_ref_sha") or data.get("mergeRefSha"))
    merge_tree = _sha(data.get("merge_ref_tree") or data.get("mergeRefTree"))
    base_sha = _sha(base_obj.get("sha") or data.get("base_sha") or data.get("baseSha"))
    base_tree = _sha(data.get("base_tree") or data.get("baseTree"))

    if merge_sha and merge_sha == candidate_head:
        raise SealError("merge_ref_identity_forbidden", "canonical head must not equal synthetic merge SHA")

    result: dict[str, Any] = {
        "accepted": True,
        "candidateHead": candidate_head,
        "candidateTree": candidate_tree or None,
        "sourceBranch": head_ref,
        "checkoutRef": candidate_head,
        "prNumber": pr.get("number") or data.get("pr_number") or data.get("prNumber"),
        "repository": (
            (head_obj.get("repo") or {}).get("full_name")
            if isinstance(head_obj.get("repo"), Mapping)
            else data.get("repository")
        ),
        "baseSha": base_sha or None,
        "baseTree": base_tree or None,
        "mergeRefEvidence": None,
    }
    if merge_sha:
        result["mergeRefEvidence"] = {
            "kind": "synthetic-merge-ref",
            "mergeSha": merge_sha,
            "mergeTree": merge_tree or None,
            "canonicalHead": candidate_head,
            "canonicalTree": candidate_tree or None,
            "baseSha": base_sha or None,
            "baseTree": base_tree or None,
            "workflowRunId": data.get("workflow_run_id") or data.get("workflowRunId"),
            "workflowRunAttempt": data.get("workflow_run_attempt") or data.get("workflowRunAttempt"),
            "promotableIdentity": False,
            "note": "Merge-ref evidence is integration-only and never replaces candidate head/tree identity.",
        }
    return result


def bind_full_receipt_identity(
    record: Mapping[str, Any],
    receipt: Mapping[str, Any] | None,
    *,
    live_head_sha: str | None = None,
    expected_tree: str | None = None,
) -> dict[str, Any]:
    """Bind a schema-v2 FullSuiteReceipt to the sealed Phase candidate.

    Exact repository / head / tree must match. Full-profile provenance is the
    receipt ``profileDigest`` (and sealed ``testProfile`` / ``profileDigest``
    when present). Phase ``candidateId`` is returned unchanged and is never
    compared to a schema-v2 canonical identity digest. Literal ``profile`` and
    ``candidateId`` receipt fields are not required and are not invented.
    """

    sealed_raw = record.get("candidateIdentity")
    if not isinstance(sealed_raw, Mapping):
        return {
            "accepted": False,
            "code": "sealed_candidate_identity_missing",
            "detail": "sealed Phase candidate identity is required",
            "candidateId": str(record.get("candidateId") or "") or None,
        }
    try:
        parsed = parse_trusted_full_suite_receipt(receipt)
        sealed = comparable_sealed_identity(sealed_raw)
    except SealError as exc:
        return {
            "accepted": False,
            "code": exc.code,
            "detail": exc.detail,
            "candidateId": str(record.get("candidateId") or "") or None,
        }
    except StateError as exc:
        return {
            "accepted": False,
            "code": exc.code,
            "detail": exc.detail,
            "candidateId": str(record.get("candidateId") or "") or None,
        }

    receipt_identity = parsed.candidate_identity
    live_head = _sha(live_head_sha) or _sha(record.get("sealedSha") or record.get("headSha"))
    sealed_head = _sha(sealed["headCommit"]) or live_head
    sealed_tree = _sha(expected_tree) or _sha(sealed["gitTree"])
    sealed_repo = sealed["repository"] or str(record.get("repository") or "").strip() or None
    phase_candidate_id = str(record.get("candidateId") or "").strip() or None

    if sealed_repo and receipt_identity.repository != sealed_repo:
        return {
            "accepted": False,
            "code": "repository_mismatch",
            "detail": "receipt repository does not match sealed Phase candidate",
            "candidateId": phase_candidate_id,
        }
    expected_head = live_head or sealed_head
    if expected_head and receipt_identity.head_commit != expected_head:
        return {
            "accepted": False,
            "code": "retained_receipt_wrong_head",
            "detail": "receipt headCommit does not match sealed Phase head",
            "candidateId": phase_candidate_id,
        }
    if sealed_head and receipt_identity.head_commit != sealed_head:
        return {
            "accepted": False,
            "code": "retained_receipt_wrong_head",
            "detail": "receipt headCommit does not match sealed Phase head",
            "candidateId": phase_candidate_id,
        }
    if sealed_tree and receipt_identity.git_tree != sealed_tree:
        return {
            "accepted": False,
            "code": "retained_receipt_wrong_tree",
            "detail": "receipt gitTree does not match sealed Phase tree",
            "candidateId": phase_candidate_id,
        }

    sealed_profile = sealed["testProfile"]
    if sealed_profile and sealed_profile != "full":
        return {
            "accepted": False,
            "code": "profile_mismatch",
            "detail": "sealed Phase candidate is not the full test profile",
            "candidateId": phase_candidate_id,
        }
    receipt_profile_digest = _digest(receipt_identity.profile_digest)
    if not receipt_profile_digest:
        return {
            "accepted": False,
            "code": "profile_mismatch",
            "detail": "receipt is missing a recognized full-profile digest",
            "candidateId": phase_candidate_id,
        }
    sealed_profile_digest = _digest(sealed["profileDigest"])
    if sealed_profile_digest and sealed_profile_digest != receipt_profile_digest:
        return {
            "accepted": False,
            "code": "profile_mismatch",
            "detail": "receipt profileDigest does not match sealed full-profile digest",
            "candidateId": phase_candidate_id,
        }
    sealed_dependency = _digest(sealed["dependencyDigest"])
    if sealed_dependency and sealed_dependency != _digest(receipt_identity.dependency_digest):
        return {
            "accepted": False,
            "code": "dependency_mismatch",
            "detail": "receipt dependencyDigest does not match sealed candidate",
            "candidateId": phase_candidate_id,
        }
    sealed_workflow = _digest(sealed["workflowDigest"])
    if sealed_workflow and sealed_workflow != _digest(receipt_identity.workflow_digest):
        return {
            "accepted": False,
            "code": "workflow_mismatch",
            "detail": "receipt workflowDigest does not match sealed candidate",
            "candidateId": phase_candidate_id,
        }

    return {
        "accepted": True,
        "code": "bound",
        "detail": "schema-v2 FullSuiteReceipt bound to sealed Phase candidate",
        "candidateId": phase_candidate_id,
        "repository": receipt_identity.repository,
        "headCommit": receipt_identity.head_commit,
        "gitTree": receipt_identity.git_tree,
        "profileDigest": receipt_profile_digest,
        "dependencyDigest": receipt_identity.dependency_digest,
        "workflowDigest": receipt_identity.workflow_digest,
    }


def parse_trusted_full_suite_receipt(receipt: Mapping[str, Any] | None) -> FullSuiteReceipt:
    """Parse and integrity-check a schemaVersion 2 FullSuiteReceipt fail-closed."""

    if receipt is None:
        raise SealError("retained_receipt_missing", "receipt body is required")
    if not isinstance(receipt, Mapping):
        raise SealError("retained_receipt_malformed", "receipt must be an object")
    if "schemaVersion" not in receipt:
        raise SealError("retained_receipt_malformed", "schemaVersion is mandatory and must be exactly 2")
    if receipt.get("schemaVersion") != 2:
        raise SealError("retained_receipt_malformed", "schemaVersion must be exactly 2")
    try:
        parsed = FullSuiteReceipt.from_dict(receipt, allow_missing_digest=False)
        if parsed.receipt_digest != compute_receipt_digest(parsed):
            raise SealError("receipt_digest_mismatch", "receiptDigest does not match canonical receipt bytes")
    except ReceiptError as exc:
        raise SealError(exc.code if exc.code else "retained_receipt_malformed", str(exc)) from exc
    return parsed


# Exhaustive inventory of trust/identity fields that may be duplicated on artifact
# metadata and the validated FullSuiteReceipt body. When metadata supplies a
# value it must equal the verified body; metadata never overrides the body.
DUPLICATED_METADATA_BODY_FIELDS: tuple[dict[str, Any], ...] = (
    {
        "name": "repository",
        "meta_keys": ("repository",),
        "code": "metadata_body_repository_mismatch",
        "body": lambda parsed: parsed.candidate_identity.repository,
    },
    {
        "name": "headCommit",
        "meta_keys": ("headCommit", "head"),
        "code": "metadata_body_head_mismatch",
        "body": lambda parsed: parsed.candidate_identity.head_commit,
        "normalize": lambda value: _sha(value) or str(value or ""),
    },
    {
        "name": "gitTree",
        "meta_keys": ("gitTree", "tree"),
        "code": "metadata_body_tree_mismatch",
        "body": lambda parsed: parsed.candidate_identity.git_tree,
        "normalize": lambda value: _sha(value) or str(value or ""),
    },
    {
        "name": "workflowRunId",
        "meta_keys": ("workflowRunId",),
        "code": "metadata_body_run_mismatch",
        "body": lambda parsed: parsed.workflow_run_id,
    },
    {
        "name": "workflowRunAttempt",
        "meta_keys": ("workflowRunAttempt",),
        "code": "metadata_body_attempt_mismatch",
        "body": lambda parsed: parsed.workflow_run_attempt,
    },
    {
        "name": "conclusion",
        "meta_keys": ("conclusion",),
        "code": "metadata_body_conclusion_mismatch",
        "body": lambda parsed: parsed.conclusion,
    },
    {
        "name": "schemaVersion",
        "meta_keys": ("schemaVersion",),
        "code": "metadata_body_schema_mismatch",
        "body": lambda parsed: parsed.schema_version,
    },
    {
        "name": "receiptDigest",
        "meta_keys": ("receiptDigest",),
        "code": "metadata_body_receipt_digest_mismatch",
        "body": lambda parsed: parsed.receipt_digest,
    },
    {
        "name": "commandDigest",
        "meta_keys": ("commandDigest",),
        "code": "metadata_body_command_digest_mismatch",
        "body": lambda parsed: parsed.command_digest,
    },
    {
        "name": "gate",
        "meta_keys": ("gate", "requiredGate"),
        "code": "metadata_body_gate_mismatch",
        # FullSuiteReceipt is reusable only for full-gate; body implies that gate.
        "body": lambda parsed: "full-gate",
    },
)


def cross_check_metadata_body_fields(
    artifact: Mapping[str, Any],
    parsed: FullSuiteReceipt,
) -> str | None:
    """Return a specific mismatch code when metadata conflicts with trusted body."""

    for spec in DUPLICATED_METADATA_BODY_FIELDS:
        body_value = spec["body"](parsed)
        normalize = spec.get("normalize")
        body_cmp = normalize(body_value) if normalize else body_value
        for key in spec["meta_keys"]:
            if key not in artifact or artifact.get(key) is None:
                continue
            meta_value = artifact.get(key)
            meta_cmp = normalize(meta_value) if normalize else meta_value
            if meta_cmp != body_cmp:
                return str(spec["code"])
    return None


def classify_receipt_artifact(
    artifact: Mapping[str, Any],
    *,
    expected: Mapping[str, Any],
) -> dict[str, Any]:
    """Classify one candidate receipt artifact before selection."""

    row = dict(artifact)
    artifact_id = str(row.get("id") or row.get("name") or "unknown")
    expected_repo = str(expected.get("repository") or "")
    expected_pr = expected.get("prNumber")
    expected_head = _sha(expected.get("headCommit") or expected.get("head") or expected.get("candidateHead"))
    expected_tree = _sha(expected.get("gitTree") or expected.get("tree") or expected.get("candidateTree"))
    expected_run = expected.get("workflowRunId")
    expected_attempt = expected.get("workflowRunAttempt")

    if row.get("readable") is False:
        head = _sha(row.get("headCommit") or row.get("head"))
        classification = "inaccessible"
        if head and expected_head and head != expected_head:
            classification = "inaccessible_stale"
        elif (
            expected_run is not None
            and row.get("workflowRunId") == expected_run
            and (expected_attempt is None or row.get("workflowRunAttempt") == expected_attempt)
            and head == expected_head
        ):
            classification = "inaccessible_expected"
        return {
            "id": artifact_id,
            "classification": classification,
            "artifact": row,
        }

    receipt = row.get("receipt")
    if receipt is None:
        return {"id": artifact_id, "classification": "malformed", "artifact": row}
    try:
        parsed = parse_trusted_full_suite_receipt(receipt if isinstance(receipt, Mapping) else None)
    except SealError:
        return {"id": artifact_id, "classification": "malformed", "artifact": row}

    mismatch = cross_check_metadata_body_fields(row, parsed)
    if mismatch:
        return {"id": artifact_id, "classification": mismatch, "artifact": row}

    # Identity for expected matching is sourced only from the verified body.
    head = parsed.candidate_identity.head_commit
    tree = parsed.candidate_identity.git_tree
    run_id = parsed.workflow_run_id
    attempt = parsed.workflow_run_attempt
    repository = parsed.candidate_identity.repository

    if expected_repo and repository != expected_repo:
        return {"id": artifact_id, "classification": "unrelated_repository", "artifact": row}
    if expected_pr is not None and row.get("prNumber") not in (None, expected_pr):
        return {"id": artifact_id, "classification": "unrelated_pr", "artifact": row}
    if expected_head and head != expected_head:
        return {"id": artifact_id, "classification": "stale_head", "artifact": row}
    if expected_tree and tree != expected_tree:
        return {"id": artifact_id, "classification": "wrong_tree", "artifact": row}
    if expected_run is not None and run_id != expected_run:
        return {"id": artifact_id, "classification": "unrelated_run", "artifact": row}
    if expected_attempt is not None and attempt != expected_attempt:
        return {"id": artifact_id, "classification": "unrelated_attempt", "artifact": row}

    exact_keys_match = (
        bool(expected_head)
        and head == expected_head
        and (not expected_tree or tree == expected_tree)
        and (expected_run is None or run_id == expected_run)
        and (expected_attempt is None or attempt == expected_attempt)
        and (not expected_repo or repository == expected_repo)
    )
    if exact_keys_match:
        return {"id": artifact_id, "classification": "exact", "artifact": row}
    return {"id": artifact_id, "classification": "non_matching", "artifact": row}


def enumerate_and_select_receipt(
    artifacts: Sequence[Mapping[str, Any]],
    *,
    expected: Mapping[str, Any],
) -> dict[str, Any]:
    """Enumerate all artifacts, skip unrelated failures, select exact receipt."""

    enumerated: list[dict[str, Any]] = []
    skipped: list[str] = []
    exact_rows: list[dict[str, Any]] = []
    inaccessible_expected: list[dict[str, Any]] = []

    for artifact in artifacts:
        classified = classify_receipt_artifact(artifact, expected=expected)
        enumerated.append(classified)
        code = classified["classification"]
        if code == "exact":
            exact_rows.append(classified)
        elif code == "inaccessible_expected":
            inaccessible_expected.append(classified)
        elif code in {
            "inaccessible",
            "inaccessible_stale",
            "metadata_body_mismatch",
            "metadata_body_repository_mismatch",
            "metadata_body_head_mismatch",
            "metadata_body_tree_mismatch",
            "metadata_body_run_mismatch",
            "metadata_body_attempt_mismatch",
            "metadata_body_conclusion_mismatch",
            "metadata_body_schema_mismatch",
            "metadata_body_receipt_digest_mismatch",
            "metadata_body_command_digest_mismatch",
            "metadata_body_gate_mismatch",
            "stale_head",
            "wrong_tree",
            "unrelated_repository",
            "unrelated_pr",
            "unrelated_run",
            "unrelated_attempt",
            "non_matching",
            "malformed",
        }:
            skipped.append(classified["id"])

    if inaccessible_expected:
        return {
            "accepted": False,
            "code": "expected_receipt_inaccessible",
            "selected": None,
            "enumerated": enumerated,
            "skipped": skipped,
            "detail": "exact expected receipt is inaccessible",
        }
    if not exact_rows:
        return {
            "accepted": False,
            "code": "exact_receipt_missing",
            "selected": None,
            "enumerated": enumerated,
            "skipped": skipped,
            "detail": "no exact retained receipt matched repository/PR/head/tree/run-attempt",
        }
    if len(exact_rows) > 1:
        return {
            "accepted": False,
            "code": "exact_receipt_ambiguous",
            "selected": None,
            "enumerated": enumerated,
            "skipped": skipped,
            "detail": "multiple exact receipts matched",
        }
    selected = exact_rows[0]["artifact"]
    return {
        "accepted": True,
        "code": "exact_receipt_selected",
        "selected": selected,
        "enumerated": enumerated,
        "skipped": skipped,
        "detail": "exact retained receipt selected after full enumeration",
    }


def phase_merge_eligibility_with_receipt(
    record: Mapping[str, Any],
    *,
    live_head_sha: str,
    retained_receipt: Mapping[str, Any] | None,
    conflict: bool = False,
    expected_tree: str | None = None,
) -> MergeEligibility:
    """Ordinary Phase merge requires gates plus an exact retained receipt."""

    base = phase_merge_eligibility(record, live_head_sha=live_head_sha, conflict=conflict)
    checks = dict(base.checks)
    head = _sha(live_head_sha)
    if retained_receipt is None:
        checks["retainedReceipt"] = False
        failed = [name for name, ok in checks.items() if not ok]
        return MergeEligibility(False, "blocked:" + ",".join(failed + ["retained_receipt_missing"]), checks)

    binding = bind_full_receipt_identity(
        record,
        retained_receipt,
        live_head_sha=head,
        expected_tree=expected_tree,
    )
    if not binding.get("accepted"):
        checks["retainedReceipt"] = False
        failed = [name for name, ok in checks.items() if not ok]
        return MergeEligibility(
            False,
            "blocked:" + ",".join(failed + [str(binding.get("code") or "retained_receipt_malformed")]),
            checks,
        )

    try:
        parsed = parse_trusted_full_suite_receipt(retained_receipt)
        live_tree = _sha(binding.get("gitTree")) or parsed.candidate_identity.git_tree
        live_identity = CandidateIdentity(
            parsed.candidate_identity.repository,
            parsed.candidate_identity.source_branch,
            head,
            live_tree,
            parsed.candidate_identity.dependency_digest,
            parsed.candidate_identity.profile_digest,
            parsed.candidate_identity.workflow_digest,
        )
        verdict = verify_receipt(parsed, live_identity, "full-gate")
        if not verdict.accepted:
            checks["retainedReceipt"] = False
            failed = [name for name, ok in checks.items() if not ok]
            return MergeEligibility(
                False,
                "blocked:" + ",".join(failed + [verdict.code]),
                checks,
            )
    except SealError as exc:
        checks["retainedReceipt"] = False
        failed = [name for name, ok in checks.items() if not ok]
        return MergeEligibility(False, "blocked:" + ",".join(failed + [exc.code]), checks)

    checks["retainedReceipt"] = True
    if not base.eligible:
        return MergeEligibility(False, base.detail, checks)
    return MergeEligibility(True, "all_current_candidate_gates_and_receipt_passed", checks)


def _installed_state_digest(state: Mapping[str, Any]) -> str:
    identity = {key: value for key, value in state.items() if key != "installedAt"}
    return "sha256:" + hashlib.sha256(
        json.dumps(identity, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def validate_recovery_dispatch(
    *,
    repo: Path,
    repository: str,
    expected_ref: str,
    expected_commit: str,
    expected_tree: str,
    package_version: str,
    checks: Mapping[str, Any],
    dependency_digest: str,
    installed_state_digest: str | None = None,
) -> dict[str, Any]:
    """Admit recovery only for an unchanged integrated development tree.

    Produces a dispatch plan.  Does not create commits, PRs, or mutate source.
    """

    root = Path(repo).resolve()
    if expected_ref != "development":
        raise RecoveryError("recovery_ref_invalid", "recovery is only allowed for development")
    commit = _sha(expected_commit)
    tree = _sha(expected_tree)
    if not commit:
        raise RecoveryError("forged_or_wrong_commit", "expected commit is invalid")
    if not tree:
        raise RecoveryError("forged_or_wrong_tree", "expected tree is invalid")
    if not repository or "/" not in repository:
        raise RecoveryError("repository_invalid", "repository must be owner/name")
    dep = _digest(dependency_digest)
    if not dep:
        raise RecoveryError("dependency_digest_invalid", "dependency digest is invalid")

    manifest_path = root / ".ide-development" / "MANIFEST.json"
    state_path = root / ".ide-development" / "installed-state.json"
    if not manifest_path.is_file():
        raise RecoveryError("manifest_missing", "exact installed release manifest is required")

    if _git(root, "status", "--porcelain"):
        raise RecoveryError("managed_drift", "recovery requires a clean managed checkout")
    if _git(root, "branch", "--show-current") != "development":
        raise RecoveryError("recovery_ref_mismatch", "checkout is not development")
    live_commit = _git(root, "rev-parse", "HEAD").lower()
    live_tree = _git(root, "rev-parse", "HEAD^{tree}").lower()
    if live_commit != commit:
        raise RecoveryError("forged_or_wrong_commit", f"live={live_commit} expected={commit}")
    if live_tree != tree:
        raise RecoveryError("forged_or_wrong_tree", f"live={live_tree} expected={tree}")

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise RecoveryError("manifest_invalid", str(exc)) from exc
    if str(manifest.get("packageVersion") or "") != package_version:
        raise RecoveryError("manifest_version_mismatch", "manifest packageVersion does not match")

    try:
        state = json.loads(state_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise RecoveryError("installed_state_invalid", str(exc)) from exc
    if str(state.get("packageVersion") or "") != package_version:
        raise RecoveryError("manifest_version_mismatch", "installed-state packageVersion does not match")
    live_digest = _installed_state_digest(state)
    if installed_state_digest and _digest(installed_state_digest) != live_digest:
        raise RecoveryError("installed_state_digest_mismatch", "installed-state digest mismatch")

    if not isinstance(checks, Mapping) or not all(
        str(checks.get(name) or "").lower() == "success" for name in ("fast", "ci", "security")
    ):
        raise RecoveryError("stale_or_failed_checks", "declared checks must all be success on the same tree")

    bound_dep = _digest(state.get("dependencyDigest"))
    if bound_dep and bound_dep != dep:
        raise RecoveryError("dependency_digest_mismatch", "dependency digest does not match installed binding")

    return {
        "accepted": True,
        "mode": "recovery",
        "repository": repository,
        "checkoutRef": "development",
        "candidateHead": commit,
        "candidateTree": tree,
        "packageVersion": package_version,
        "dependencyDigest": dep,
        "installedStateDigest": live_digest,
        "checks": {name: "success" for name in ("fast", "ci", "security")},
        "opensPullRequest": False,
        "createsCommit": False,
        "receiptSchemaVersion": 2,
        "promotable": True,
        "detail": "recovery dispatch admitted for unchanged integrated development tree",
    }


def evaluate_recovered_receipt_for_promotion(
    receipt: Mapping[str, Any],
    candidate_identity: Mapping[str, Any] | CandidateIdentity,
    *,
    required_gate: str = "full-gate",
    transition_receipt: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Accept recovered receipts for unchanged trees; reject content changes."""

    try:
        verdict = verify_receipt(
            receipt,
            candidate_identity,
            required_gate,
            transition_receipt=transition_receipt,
        )
    except ReceiptError as exc:
        return {"accepted": False, "code": exc.code, "detail": str(exc)}
    if verdict.accepted:
        return {
            "accepted": True,
            "code": "accepted",
            "detail": verdict.message or "recovered receipt reusable for unchanged promotion",
            "sourceCommit": verdict.source_commit,
            "promotionCommit": verdict.promotion_commit,
        }
    # Map tree/content identity failures to the U06 content_changed signal.
    code = verdict.code
    if code in {"tree_mismatch", "source_mismatch", "dependency_mismatch", "profile_mismatch", "workflow_mismatch"}:
        code = "content_changed"
    return {"accepted": False, "code": code, "detail": verdict.message or code}


def _json_print(payload: Mapping[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    resolve = commands.add_parser("resolve-head", help="resolve canonical PR head (never merge-ref identity)")
    resolve.add_argument("--payload", type=Path, required=True)

    select = commands.add_parser("select-receipt", help="enumerate artifacts and select exact receipt")
    select.add_argument("--artifacts", type=Path, required=True)
    select.add_argument("--expected", type=Path, required=True)

    merge = commands.add_parser("merge-eligibility", help="phase merge eligibility with retained receipt")
    merge.add_argument("--record", type=Path, required=True)
    merge.add_argument("--live-head", required=True)
    merge.add_argument("--receipt", type=Path)
    merge.add_argument("--expected-tree", default="")

    recovery = commands.add_parser("validate-recovery", help="validate recovery dispatch without commit/PR")
    recovery.add_argument("--repo", type=Path, required=True)
    recovery.add_argument("--repository", required=True)
    recovery.add_argument("--expected-ref", default="development")
    recovery.add_argument("--expected-commit", required=True)
    recovery.add_argument("--expected-tree", required=True)
    recovery.add_argument("--package-version", required=True)
    recovery.add_argument("--checks-json", type=Path, required=True)
    recovery.add_argument("--dependency-digest", required=True)
    recovery.add_argument("--installed-state-digest", default="")

    promote = commands.add_parser("evaluate-recovered-promotion", help="reuse recovered receipt for promotion")
    promote.add_argument("--receipt", type=Path, required=True)
    promote.add_argument("--identity", type=Path, required=True)
    promote.add_argument("--gate", default="full-gate")

    args = parser.parse_args(argv)
    try:
        if args.command == "resolve-head":
            payload = json.loads(args.payload.read_text(encoding="utf-8"))
            _json_print(resolve_canonical_candidate_head(payload))
            return 0
        if args.command == "select-receipt":
            artifacts = json.loads(args.artifacts.read_text(encoding="utf-8"))
            expected = json.loads(args.expected.read_text(encoding="utf-8"))
            result = enumerate_and_select_receipt(artifacts, expected=expected)
            _json_print(result)
            return 0 if result.get("accepted") else 1
        if args.command == "merge-eligibility":
            record = json.loads(args.record.read_text(encoding="utf-8"))
            receipt = None
            if args.receipt:
                receipt = json.loads(args.receipt.read_text(encoding="utf-8"))
            verdict = phase_merge_eligibility_with_receipt(
                record,
                live_head_sha=args.live_head,
                retained_receipt=receipt,
                expected_tree=args.expected_tree or None,
            )
            _json_print(verdict.__dict__ if hasattr(verdict, "__dict__") else {"eligible": verdict.eligible, "detail": verdict.detail, "checks": verdict.checks})
            return 0 if verdict.eligible else 1
        if args.command == "validate-recovery":
            checks = json.loads(args.checks_json.read_text(encoding="utf-8"))
            plan = validate_recovery_dispatch(
                repo=args.repo,
                repository=args.repository,
                expected_ref=args.expected_ref,
                expected_commit=args.expected_commit,
                expected_tree=args.expected_tree,
                package_version=args.package_version,
                checks=checks,
                dependency_digest=args.dependency_digest,
                installed_state_digest=args.installed_state_digest or None,
            )
            _json_print(plan)
            return 0
        if args.command == "evaluate-recovered-promotion":
            receipt = json.loads(args.receipt.read_text(encoding="utf-8"))
            identity = json.loads(args.identity.read_text(encoding="utf-8"))
            result = evaluate_recovered_receipt_for_promotion(receipt, identity, required_gate=args.gate)
            _json_print(result)
            return 0 if result.get("accepted") else 1
    except (SealError, RecoveryError) as exc:
        _json_print({"accepted": False, "code": exc.code, "detail": exc.detail})
        return 2
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        _json_print({"accepted": False, "code": "invalid_input", "detail": str(exc)})
        return 2
    return 2


if __name__ == "__main__":
    sys.exit(main())

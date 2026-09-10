"""Validate the OpenClaw Prime execution-approval snapshot against frozen authority."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path
from typing import Any, Mapping

SCHEMA_VERSION = 1
KIND = "openclaw-prime-lisa-execution-approval-snapshot"
PACKET_IDS = (
    "PKT-01",
    "PKT-02",
    "PKT-03",
    "PKT-04",
    "PKT-05",
    "PKT-06",
    "PKT-07",
    "PKT-08",
    "PKT-09",
    "PKT-10",
    "PKT-11",
    "LP-01",
    "AW-01",
)
PREREQUISITES = (
    "platform_contract_accepted",
    "brain_provider_contract_accepted",
    "skills_provider_contract_accepted",
    "libraries_contract_audit_accepted",
    "autowork_contract_audit_accepted",
    "skills_google_workspace_release_qualified",
    "brain_mcp_v2_contract_accepted",
    "skills_mcp_v2_contract_accepted",
    "provider_release_set_accepted",
    "skills_watcher_contracts_accepted",
)
AUTHORIZED_DEVELOPMENT_COMMIT = "452a7f1f31b1d1947d4bb992f91457e5a238ea31"
AUTHORIZED_DEVELOPMENT_TREE = "56c96716ede75bdc896791ec2098cf1bf2594bb6"
FROZEN_AUTHORITY_SHA256 = (
    "sha256:427385ae17832261e74cf64fddc1f8b0d16f74563c431e320c3afe03ed7c9c6d"
)
VALIDATION_POLICY_DIGEST = (
    "sha256:445953e776fa6594bc96f047794616164ec75b213a07c0e9300630db1ec24a17"
)

REQUIRED_TOP = (
    "$schema",
    "schemaVersion",
    "kind",
    "snapshotId",
    "approvalScope",
    "workerIssueAuthorized",
    "approvedProtectedDevelopment",
    "frozenDispatchAuthority",
    "principalPolicy",
    "ideManaged",
    "forbiddenActions",
    "packetDag",
    "runtimeAuthority",
    "externalPrerequisites",
    "packets",
    "holds",
    "verification",
)


class SnapshotError(ValueError):
    """Execution-approval snapshot failed closed validation."""


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _require(cond: bool, message: str) -> None:
    if not cond:
        raise SnapshotError(message)


def classify_openclaw_packets(checkout: Path) -> dict[str, dict[str, Any]]:
    sys.path.insert(0, str(checkout / ".linktrend" / "openclaw-prime"))
    from validate_customization_boundary import classify, load_json as load_boundary

    boundary = load_boundary(checkout / ".linktrend/openclaw-prime/customization-boundary.json")
    authority = load_json(checkout / "docs/execution/openclaw-prime-lisa/dispatch-authority.json")
    manifest = load_json(
        checkout / "docs/execution/openclaw-prime-lisa/openclaw-prime-lisa.execution-manifest.json"
    )
    owned = {packet["id"]: packet["ownedPaths"] for packet in manifest["packets"]}
    result: dict[str, dict[str, Any]] = {}
    for packet_id, record in authority["packets"].items():
        if packet_id.startswith("PKT-"):
            classes = [classify(path, boundary) for path in owned[packet_id]]
            customization_scoped = all(item != "untouched-upstream-excluded" for item in classes)
        else:
            customization_scoped = False
        local_deps = list(record["localDependencies"])
        external = list(record["externalPrerequisites"])
        dependency_ready = not local_deps and not external
        result[packet_id] = {
            "customizationScoped": customization_scoped,
            "localDependencies": local_deps,
            "externalPrerequisites": external,
            "dependencyReady": dependency_ready,
        }
    return result


def validate_snapshot(snapshot: Mapping[str, Any], *, checkout: Path | None = None) -> None:
    checkout = checkout or repo_root()
    missing = [key for key in REQUIRED_TOP if key not in snapshot]
    _require(not missing, f"missing keys: {missing}")
    extra = [key for key in snapshot if key not in REQUIRED_TOP]
    _require(not extra, f"unknown keys: {extra}")
    _require(snapshot["schemaVersion"] == SCHEMA_VERSION, "schemaVersion must be 1")
    _require(snapshot["kind"] == KIND, "kind mismatch")
    _require(snapshot["workerIssueAuthorized"] is False, "workerIssueAuthorized must be false")
    identity = snapshot["approvedProtectedDevelopment"]
    _require(identity["repository"] == "linktrend/openclaw_prime", "repository mismatch")
    _require(identity["ref"] == "development", "approved ref must be development")
    _require(identity["commit"] == AUTHORIZED_DEVELOPMENT_COMMIT, "approved commit mismatch")
    _require(identity["tree"] == AUTHORIZED_DEVELOPMENT_TREE, "approved tree mismatch")

    authority_path = checkout / "docs/execution/openclaw-prime-lisa/dispatch-authority.json"
    digest = sha256_file(authority_path)
    frozen = snapshot["frozenDispatchAuthority"]
    _require(frozen["sha256"] == digest, "frozen authority digest does not match bytes")
    _require(frozen["sha256"] == FROZEN_AUTHORITY_SHA256, "frozen authority digest drifted")
    validation_policy = load_json(authority_path)["validationPolicy"]
    policy_payload = {key: value for key, value in validation_policy.items() if key != "digest"}
    computed_policy = "sha256:" + hashlib.sha256(
        json.dumps(policy_payload, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    _require(validation_policy["digest"] == VALIDATION_POLICY_DIGEST, "validation policy digest drifted")
    _require(computed_policy == VALIDATION_POLICY_DIGEST, "validation policy digest is not canonical")
    _require(
        validation_policy["phaseValidation"]["customizationScope"]
        == "exact-normalized-protected-base-to-phase-diff",
        "phase customization scope drifted",
    )
    _require(
        validation_policy["phaseValidation"]["staticProvenanceExcludesProvenPhasePath"] is False,
        "static provenance must not exclude a proven Phase path",
    )
    _require(frozen["rewrittenByThisSnapshot"] is False, "must not rewrite frozen authority")
    _require(frozen["executionAuthorizedAtCheckpoint"] is False, "v4 checkpoint remains unauthorized")

    policy = snapshot["principalPolicy"]
    _require(policy["primaryExecutor"]["modelId"] == "cursor-grok-4.6-medium", "primary model")
    _require(policy["primaryExecutor"]["transport"] == "cursor-sdk", "primary transport")
    _require(policy["primaryExecutor"]["fast"] is False, "fast is forbidden")
    fallback = policy["fallbackOrConcurrentExecutor"]
    _require(fallback["modelId"] == "gpt-5.6-luna", "fallback model")
    _require(fallback["transport"] == "codex-cli", "fallback transport")
    _require(fallback["reasoning"] == "high", "fallback reasoning")
    _require(policy["duplicateImplementation"] is False, "duplicate implementation forbidden")
    _require(snapshot["ideManaged"]["modifiedByThisSnapshot"] is False, "IDE managed must stay read-only")
    _require(snapshot["ideManaged"]["packageVersion"] == "2.5.2", "IDE version")

    runtime = snapshot["runtimeAuthority"]
    for key in (
        "snapshotPresent",
        "packetTokenBudgetsPresent",
        "authenticatedAccountPlanReadbackPresent",
        "preparedIntentAndEffectiveModelReadbackPresent",
        "hostedCapacitySnapshotPresent",
    ):
        _require(runtime[key] is False, f"{key} must fail closed as absent")
    _require(runtime["failClosed"] is True, "runtime failClosed")

    for name in PREREQUISITES:
        state = snapshot["externalPrerequisites"][name]
        _require(state["receiptPresent"] is False, f"{name} receipt must be absent")
        _require(
            state["checkpointState"] == "PENDING_RUNTIME_EVIDENCE",
            f"{name} must remain pending",
        )

    classified = classify_openclaw_packets(checkout)
    packets = snapshot["packets"]
    _require(set(packets) == set(PACKET_IDS), "packet set mismatch")
    authorized = [packet_id for packet_id, item in packets.items() if item["dispatchAuthorized"]]
    _require(authorized == ["PKT-01"], f"dispatchAuthorized must be PKT-01 only, got {authorized}")
    for packet_id, item in packets.items():
        expected = classified[packet_id]
        _require(
            item["customizationScoped"] == expected["customizationScoped"],
            f"{packet_id} customizationScoped mismatch",
        )
        _require(
            item["localDependencies"] == expected["localDependencies"],
            f"{packet_id} localDependencies mismatch",
        )
        _require(
            item["externalPrerequisites"] == expected["externalPrerequisites"],
            f"{packet_id} externalPrerequisites mismatch",
        )
        expected_ready = expected["dependencyReady"]
        if packet_id in {"LP-01", "AW-01"}:
            expected_ready = False
        _require(item["dependencyReady"] == expected_ready, f"{packet_id} dependencyReady mismatch")
        expected_authorized = (
            packet_id == "PKT-01"
            and expected["customizationScoped"]
            and expected["dependencyReady"]
        )
        _require(item["dispatchAuthorized"] is expected_authorized, f"{packet_id} dispatchAuthorized")
        _require(item["liveMutationAuthorized"] is False, f"{packet_id} live mutation")
        _require(item["workerIssueAuthorized"] is False, f"{packet_id} worker issue")

    dag = snapshot["packetDag"]
    _require(dag["customizationScopedDependencyReady"] == ["PKT-01"], "DAG ready set")
    _require("PKT-04" in dag["notCustomizationScoped"], "PKT-04 must remain out of customization")
    _require("PKT-09" in dag["liveOrProductionForbidden"], "PKT-09 live forbidden")
    _require("PKT-11" in dag["liveOrProductionForbidden"], "PKT-11 production forbidden")
    _require(snapshot["verification"]["fullOrBroadSuites"] == "forbidden", "no Full suites")


def validate_files(checkout: Path | None = None) -> dict[str, Any]:
    checkout = checkout or repo_root()
    path = checkout / "docs/execution/openclaw-prime-lisa/execution-approval-snapshot.json"
    snapshot = load_json(path)
    validate_snapshot(snapshot, checkout=checkout)
    return snapshot


def main() -> int:
    validate_files()
    print("execution-approval-snapshot: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

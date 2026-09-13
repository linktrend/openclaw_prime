"""Focused regression tests for accepted multi-commit Phase history."""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.gitops.packager_coordinator import (
    ISOLATED_HANDOFF_NAME,
    ISOLATED_PROVIDER_CONSUMER_HANDOFF_NAME,
    ISOLATED_RECORD_NAME,
    AcceptedSource,
    CoordinatorError,
    GitPushAdapter,
    MemoryGitHub,
    _merge_base,
    _read_isolated_state_pair,
    _unique_phase_commits,
    assemble_phase,
    hydrate_existing_phase_state,
)


def git(root: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=root,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


class AcceptedPhaseHistoryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        git(self.root, "init", "-q", "-b", "development")
        git(self.root, "config", "user.email", "phase@example.invalid")
        git(self.root, "config", "user.name", "Phase test")
        self._commit("base.txt", "base\n", "base")
        self.base = git(self.root, "rev-parse", "HEAD")

    def _commit(self, path: str, content: str, message: str) -> str:
        target = self.root / path
        target.write_text(content, encoding="utf-8")
        git(self.root, "add", "--", path)
        git(self.root, "commit", "-qm", message)
        return git(self.root, "rev-parse", "HEAD")

    def _accepted_phase(self, *, merge_newest_tip: bool) -> tuple[str, str]:
        git(self.root, "checkout", "-qb", "issue/1-multi", self.base)
        ancestor = self._commit("one.txt", "one\n", "accepted ancestor")
        accepted_tip = self._commit("two.txt", "two\n", "accepted tip")
        git(self.root, "checkout", "-q", "development")
        git(self.root, "checkout", "-qb", "phase/next", self.base)
        merge_source = accepted_tip if merge_newest_tip else ancestor
        git(self.root, "merge", "--no-ff", "--no-edit", merge_source)
        return accepted_tip, git(self.root, "rev-parse", "HEAD")

    def test_multi_commit_accepted_issue_can_revise_existing_phase(self) -> None:
        accepted_tip, phase_head = self._accepted_phase(merge_newest_tip=False)
        self.assertEqual(
            _unique_phase_commits(
                self.root,
                development_sha=self.base,
                phase_sha=phase_head,
                accepted_shas={accepted_tip},
            ),
            [],
        )

    def test_unrelated_phase_commit_still_blocks_reuse(self) -> None:
        accepted_tip, _phase_head = self._accepted_phase(merge_newest_tip=True)
        unique = self._commit("unique.txt", "unique\n", "unrelated phase work")
        self.assertEqual(
            _unique_phase_commits(
                self.root,
                development_sha=self.base,
                phase_sha=unique,
                accepted_shas={accepted_tip},
            ),
            [unique],
        )


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


class HydrationFixture:
    def __init__(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.origin = root / "origin.git"
        self.work = root / "work"
        self.work.mkdir()
        git(root, "init", "--bare", str(self.origin))
        git(self.work, "init", "-q", "-b", "development")
        git(self.work, "config", "user.email", "phase@example.invalid")
        git(self.work, "config", "user.name", "Phase test")
        git(self.work, "remote", "add", "origin", str(self.origin))
        write(self.work / "base.txt", "base\n")
        git(self.work, "add", "base.txt")
        git(self.work, "commit", "-qm", "base")
        git(self.work, "push", "-q", "-u", "origin", "development")
        self.github = MemoryGitHub(repository="owner/name")

    def cleanup(self) -> None:
        self.tmp.cleanup()

    def accept_issue(self, number: int, filename: str, content: str) -> AcceptedSource:
        branch = f"issue/{number}-{filename.split('.')[0]}"
        git(self.work, "checkout", "-B", branch, "development")
        write(self.work / filename, content)
        git(self.work, "add", filename)
        git(self.work, "commit", "-qm", f"issue {number}")
        sha = git(self.work, "rev-parse", "HEAD")
        git(self.work, "push", "-q", "-u", "origin", branch)
        git(self.work, "checkout", "development")
        source = AcceptedSource(branch=branch, sha=sha, order=number)
        self.github.ready_shas.add(sha)
        self.github.evidence[sha] = {"schemaVersion": 1, "headSha": sha, "classification": "tests"}
        return source

    def assemble(self, sources: list[AcceptedSource]):
        ordered = [
            AcceptedSource(branch=item.branch, sha=item.sha, order=index)
            for index, item in enumerate(sources, start=1)
        ]
        return assemble_phase(
            repo=self.work,
            repository="owner/name",
            sources=ordered,
            github=self.github,
            pusher=GitPushAdapter(),
            phase_branch="phase/next",
            expected_repository="owner/name",
        )


class ExistingPhaseStateHydrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fx = HydrationFixture()
        self.addCleanup(self.fx.cleanup)

    def _clear_isolated_state(self, state_dir: Path) -> None:
        for name in (ISOLATED_RECORD_NAME, ISOLATED_HANDOFF_NAME, ISOLATED_PROVIDER_CONSUMER_HANDOFF_NAME):
            path = state_dir / name
            if path.exists():
                path.unlink()

    def test_exact_supplied_record_hydrates_isolated_state_only(self) -> None:
        one = self.fx.accept_issue(41, "hydrate.txt", "hydrate\n")
        assembled = self.fx.assemble([one])
        ensure_calls = self.fx.github.ensure_calls
        remote_before = git(self.fx.work, "ls-remote", "--heads", "origin", "refs/heads/phase/next")
        state_dir = Path(assembled["stateDir"])
        self._clear_isolated_state(state_dir)
        caller = git(self.fx.work, "rev-parse", "HEAD")
        result = hydrate_existing_phase_state(
            repo=self.fx.work,
            record=assembled["record"],
            github=self.fx.github,
            expected_repository="owner/name",
        )
        self.assertEqual(result["action"], "hydrated")
        self.assertFalse(result["idempotent"])
        self.assertEqual(self.fx.github.ensure_calls, ensure_calls)
        self.assertEqual(self.fx.github.labels, [])
        self.assertEqual(self.fx.github.workflow_dispatches, [])
        self.assertEqual(
            git(self.fx.work, "ls-remote", "--heads", "origin", "refs/heads/phase/next"),
            remote_before,
        )
        self.assertEqual(git(self.fx.work, "rev-parse", "HEAD"), caller)
        self.assertEqual(git(self.fx.work, "rev-parse", "--abbrev-ref", "HEAD"), "development")
        self.assertFalse((self.fx.work / ".linktrend" / "phase-handoff.json").exists())
        written_record, written_handoff = _read_isolated_state_pair(state_dir)
        self.assertEqual(written_record["headSha"], assembled["headSha"])
        self.assertEqual(written_record["gitTree"], assembled["gitTree"])
        self.assertEqual(written_handoff["headCommit"], assembled["headSha"])
        self.assertEqual(written_handoff["phasePr"]["number"], assembled["phasePr"]["number"])
        self.assertTrue(written_handoff["valid"])

    def test_identical_isolated_state_is_idempotent(self) -> None:
        one = self.fx.accept_issue(42, "again.txt", "again\n")
        assembled = self.fx.assemble([one])
        result = hydrate_existing_phase_state(
            repo=self.fx.work,
            record=assembled["record"],
            github=self.fx.github,
            expected_repository="owner/name",
        )
        self.assertEqual(result["action"], "reused")
        self.assertTrue(result["idempotent"])

    def test_wrong_repository_is_refused(self) -> None:
        one = self.fx.accept_issue(43, "repo.txt", "repo\n")
        assembled = self.fx.assemble([one])
        record = dict(assembled["record"])
        record["repository"] = "other/name"
        with self.assertRaisesRegex(CoordinatorError, "wrong_repository"):
            hydrate_existing_phase_state(
                repo=self.fx.work,
                record=record,
                github=self.fx.github,
                expected_repository="owner/name",
            )

    def test_stale_head_is_refused(self) -> None:
        one = self.fx.accept_issue(44, "stale.txt", "stale\n")
        assembled = self.fx.assemble([one])
        record = dict(assembled["record"])
        record["headSha"] = one.sha
        with self.assertRaisesRegex(CoordinatorError, "stale_commit"):
            hydrate_existing_phase_state(
                repo=self.fx.work,
                record=record,
                github=self.fx.github,
                expected_repository="owner/name",
            )

    def test_protected_phase_branch_is_refused(self) -> None:
        one = self.fx.accept_issue(45, "prot.txt", "prot\n")
        assembled = self.fx.assemble([one])
        record = dict(assembled["record"])
        record["phaseBranch"] = "main"
        record["phaseId"] = "main"
        with self.assertRaisesRegex(CoordinatorError, "invalid_phase_branch"):
            hydrate_existing_phase_state(
                repo=self.fx.work,
                record=record,
                github=self.fx.github,
                expected_repository="owner/name",
            )

    def test_malformed_record_is_refused(self) -> None:
        one = self.fx.accept_issue(46, "bad.txt", "bad\n")
        assembled = self.fx.assemble([one])
        record = dict(assembled["record"])
        record["kind"] = "phase-note"
        with self.assertRaisesRegex(CoordinatorError, "malformed_phase_record"):
            hydrate_existing_phase_state(
                repo=self.fx.work,
                record=record,
                github=self.fx.github,
                expected_repository="owner/name",
            )

    def test_duplicate_accepted_issue_is_refused(self) -> None:
        one = self.fx.accept_issue(47, "dup.txt", "dup\n")
        assembled = self.fx.assemble([one])
        record = dict(assembled["record"])
        commit = dict(record["acceptedCommits"][0])
        record["acceptedCommits"] = [commit, dict(commit)]
        record["dependencyOrder"] = [one.branch, one.branch]
        with self.assertRaisesRegex(CoordinatorError, "duplicate_issue"):
            hydrate_existing_phase_state(
                repo=self.fx.work,
                record=record,
                github=self.fx.github,
                expected_repository="owner/name",
            )

    def test_missing_evidence_is_refused(self) -> None:
        one = self.fx.accept_issue(48, "ev.txt", "ev\n")
        assembled = self.fx.assemble([one])
        github = MemoryGitHub(repository="owner/name")
        github.prs = dict(self.fx.github.prs)
        with self.assertRaisesRegex(CoordinatorError, "evidence_missing"):
            hydrate_existing_phase_state(
                repo=self.fx.work,
                record=assembled["record"],
                github=github,
                expected_repository="owner/name",
            )

    def test_draft_pr_mismatch_is_refused(self) -> None:
        one = self.fx.accept_issue(49, "pr.txt", "pr\n")
        assembled = self.fx.assemble([one])
        record = dict(assembled["record"])
        record["phasePr"] = dict(record["phasePr"], number=99)
        with self.assertRaisesRegex(CoordinatorError, "phase_pr_mismatch"):
            hydrate_existing_phase_state(
                repo=self.fx.work,
                record=record,
                github=self.fx.github,
                expected_repository="owner/name",
            )

    def test_duplicate_isolated_state_is_refused(self) -> None:
        one = self.fx.accept_issue(50, "exist.txt", "exist\n")
        assembled = self.fx.assemble([one])
        record = dict(assembled["record"])
        record["candidateRevision"] = "ffffffffffffffff"
        with self.assertRaisesRegex(CoordinatorError, "stale_commit"):
            hydrate_existing_phase_state(
                repo=self.fx.work,
                record=record,
                github=self.fx.github,
                expected_repository="owner/name",
            )
        drifted = dict(assembled["record"])
        state_dir = Path(assembled["stateDir"])
        drifted_on_disk, drifted_handoff = _read_isolated_state_pair(state_dir)
        drifted_on_disk["headSha"] = one.sha
        drifted_handoff["headCommit"] = one.sha
        (state_dir / ISOLATED_RECORD_NAME).write_text(
            json.dumps(drifted_on_disk, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        (state_dir / ISOLATED_HANDOFF_NAME).write_text(
            json.dumps(drifted_handoff, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        with self.assertRaisesRegex(CoordinatorError, "duplicate_active_phase"):
            hydrate_existing_phase_state(
                repo=self.fx.work,
                record=drifted,
                github=self.fx.github,
                expected_repository="owner/name",
            )


class IsolatedStateCompletePairReaderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fx = HydrationFixture()
        self.addCleanup(self.fx.cleanup)

    def _assembled_state(self, number: int, filename: str) -> tuple[AcceptedSource, dict[str, object], Path]:
        source = self.fx.accept_issue(number, filename, f"{filename}\n")
        assembled = self.fx.assemble([source])
        return source, assembled, Path(assembled["stateDir"])

    def test_hydrate_missing_handoff_fails_closed(self) -> None:
        _source, assembled, state_dir = self._assembled_state(71, "hydrate-handoff.txt")
        (state_dir / ISOLATED_HANDOFF_NAME).unlink()
        with self.assertRaisesRegex(CoordinatorError, "isolated_state_incomplete"):
            hydrate_existing_phase_state(
                repo=self.fx.work,
                record=assembled["record"],
                github=self.fx.github,
                expected_repository="owner/name",
            )

    def test_hydrate_missing_record_fails_closed(self) -> None:
        _source, assembled, state_dir = self._assembled_state(72, "hydrate-record.txt")
        (state_dir / ISOLATED_RECORD_NAME).unlink()
        with self.assertRaisesRegex(CoordinatorError, "isolated_state_incomplete"):
            hydrate_existing_phase_state(
                repo=self.fx.work,
                record=assembled["record"],
                github=self.fx.github,
                expected_repository="owner/name",
            )

    def test_hydrate_mixed_pair_identities_fail_closed(self) -> None:
        source, assembled, state_dir = self._assembled_state(73, "hydrate-mixed.txt")
        record, _handoff = _read_isolated_state_pair(state_dir)
        record["headSha"] = source.sha
        (state_dir / ISOLATED_RECORD_NAME).write_text(
            json.dumps(record, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        with self.assertRaisesRegex(CoordinatorError, "isolated_state_incomplete"):
            hydrate_existing_phase_state(
                repo=self.fx.work,
                record=assembled["record"],
                github=self.fx.github,
                expected_repository="owner/name",
            )

    def test_assemble_missing_handoff_fails_closed(self) -> None:
        source, _assembled, state_dir = self._assembled_state(74, "assemble-handoff.txt")
        (state_dir / ISOLATED_HANDOFF_NAME).unlink()
        with self.assertRaisesRegex(CoordinatorError, "isolated_state_incomplete"):
            self.fx.assemble([source])

    def test_assemble_missing_record_fails_closed(self) -> None:
        source, _assembled, state_dir = self._assembled_state(75, "assemble-record.txt")
        (state_dir / ISOLATED_RECORD_NAME).unlink()
        with self.assertRaisesRegex(CoordinatorError, "isolated_state_incomplete"):
            self.fx.assemble([source])

    def test_assemble_mixed_pair_identities_fail_closed(self) -> None:
        source, _assembled, state_dir = self._assembled_state(76, "assemble-mixed.txt")
        record, _handoff = _read_isolated_state_pair(state_dir)
        record["headSha"] = source.sha
        (state_dir / ISOLATED_RECORD_NAME).write_text(
            json.dumps(record, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        with self.assertRaisesRegex(CoordinatorError, "isolated_state_incomplete"):
            self.fx.assemble([source])


class IsolatedStateAtomicPublicationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fx = HydrationFixture()
        self.addCleanup(self.fx.cleanup)

    def _pair_identities(self, state_dir: Path) -> tuple[str, str, str, str]:
        record, handoff = _read_isolated_state_pair(state_dir)
        return (
            str(record.get("headSha") or ""),
            str(record.get("gitTree") or ""),
            str(handoff.get("headCommit") or ""),
            str(handoff.get("gitTree") or ""),
        )

    def test_failure_before_publication_keeps_old_complete_pair(self) -> None:
        one = self.fx.accept_issue(61, "atomic-old.txt", "old\n")
        assembled = self.fx.assemble([one])
        state_dir = Path(assembled["stateDir"])
        old_pair = self._pair_identities(state_dir)
        self.assertEqual(old_pair[0], old_pair[2])
        self.assertEqual(old_pair[1], old_pair[3])

        def boom(staging: Path, live: Path) -> None:
            raise RuntimeError("publication blocked")

        with patch(
            "scripts.gitops.packager_coordinator._publish_isolated_state_dir",
            side_effect=boom,
        ):
            with self.assertRaisesRegex(RuntimeError, "publication blocked"):
                hydrate_existing_phase_state(
                    repo=self.fx.work,
                    record=assembled["record"],
                    github=self.fx.github,
                    expected_repository="owner/name",
                )
        self.assertEqual(self._pair_identities(state_dir), old_pair)
        self.assertFalse(any(state_dir.parent.glob(f".{state_dir.name}-next-*")))

    def test_failed_live_swap_rolls_back_to_old_complete_pair(self) -> None:
        one = self.fx.accept_issue(62, "atomic-swap.txt", "swap\n")
        assembled = self.fx.assemble([one])
        state_dir = Path(assembled["stateDir"])
        old_pair = self._pair_identities(state_dir)
        real_rename = os.rename
        calls = {"n": 0}

        def flaky_rename(src: object, dst: object) -> None:
            calls["n"] += 1
            if calls["n"] == 2:
                raise OSError("swap failed")
            real_rename(src, dst)

        with patch("scripts.gitops.packager_coordinator.os.rename", side_effect=flaky_rename):
            with self.assertRaises(OSError):
                hydrate_existing_phase_state(
                    repo=self.fx.work,
                    record=assembled["record"],
                    github=self.fx.github,
                    expected_repository="owner/name",
                )
        self.assertEqual(self._pair_identities(state_dir), old_pair)

    def test_successful_rewrite_publishes_new_complete_pair(self) -> None:
        first = self.fx.accept_issue(63, "atomic-first.txt", "first\n")
        assembled = self.fx.assemble([first])
        state_dir = Path(assembled["stateDir"])
        second = self.fx.accept_issue(64, "atomic-second.txt", "second\n")
        updated = self.fx.assemble([first, second])
        self.assertEqual(Path(updated["stateDir"]), state_dir)
        record, handoff = _read_isolated_state_pair(state_dir)
        self.assertEqual(record["headSha"], updated["headSha"])
        self.assertEqual(record["gitTree"], updated["gitTree"])
        self.assertEqual(handoff["headCommit"], updated["headSha"])
        self.assertEqual(handoff["gitTree"], updated["gitTree"])
        self.assertNotEqual(record["headSha"], assembled["headSha"])

    def test_failure_before_first_publication_leaves_no_partial_pair(self) -> None:
        one = self.fx.accept_issue(65, "atomic-empty.txt", "empty\n")
        assembled = self.fx.assemble([one])
        state_dir = Path(assembled["stateDir"])
        for name in (ISOLATED_RECORD_NAME, ISOLATED_HANDOFF_NAME, ISOLATED_PROVIDER_CONSUMER_HANDOFF_NAME):
            path = state_dir / name
            if path.exists():
                path.unlink()

        def boom(staging: Path, live: Path) -> None:
            raise RuntimeError("publication blocked")

        with patch(
            "scripts.gitops.packager_coordinator._publish_isolated_state_dir",
            side_effect=boom,
        ):
            with self.assertRaisesRegex(RuntimeError, "publication blocked"):
                hydrate_existing_phase_state(
                    repo=self.fx.work,
                    record=assembled["record"],
                    github=self.fx.github,
                    expected_repository="owner/name",
                )
        self.assertFalse((state_dir / ISOLATED_RECORD_NAME).exists())
        self.assertFalse((state_dir / ISOLATED_HANDOFF_NAME).exists())
        with self.assertRaisesRegex(CoordinatorError, "isolated_state_incomplete"):
            _read_isolated_state_pair(state_dir)

    def test_omitted_provider_consumer_handoff_stays_with_replaced_generation(self) -> None:
        one = self.fx.accept_issue(66, "typed-keep.txt", "keep\n")
        typed = {
            "schemaVersion": 1,
            "kind": "provider-consumer-handoff",
            "artifact": "optional-keep",
        }
        assembled = assemble_phase(
            repo=self.fx.work,
            repository="owner/name",
            sources=[AcceptedSource(branch=one.branch, sha=one.sha, order=1)],
            github=self.fx.github,
            pusher=GitPushAdapter(),
            phase_branch="phase/next",
            expected_repository="owner/name",
            provider_consumer_handoff=typed,
        )
        state_dir = Path(assembled["stateDir"])
        result = hydrate_existing_phase_state(
            repo=self.fx.work,
            record=assembled["record"],
            github=self.fx.github,
            expected_repository="owner/name",
        )
        self.assertEqual(result["action"], "reused")
        record, handoff = _read_isolated_state_pair(state_dir)
        self.assertEqual(record["headSha"], handoff["headCommit"])
        self.assertEqual(
            json.loads((state_dir / ISOLATED_PROVIDER_CONSUMER_HANDOFF_NAME).read_text(encoding="utf-8")),
            typed,
        )


class RecoveredParallelTipOverlapTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fx = HydrationFixture()
        self.addCleanup(self.fx.cleanup)

    def _branch_from(self, parent: str, number: int, filename: str, content: str) -> AcceptedSource:
        branch = f"issue/{number}-{filename.split('.')[0]}"
        git(self.fx.work, "checkout", "-B", branch, parent)
        write(self.fx.work / filename, content)
        git(self.fx.work, "add", filename)
        git(self.fx.work, "commit", "-qm", f"issue {number}")
        sha = git(self.fx.work, "rev-parse", "HEAD")
        git(self.fx.work, "push", "-q", "-u", "origin", branch)
        git(self.fx.work, "checkout", "development")
        source = AcceptedSource(branch=branch, sha=sha, order=number)
        self.fx.github.ready_shas.add(sha)
        self.fx.github.evidence[sha] = {
            "schemaVersion": 1,
            "headSha": sha,
            "classification": "tests",
        }
        return source

    def test_parallel_tips_sharing_post_development_history_assemble(self) -> None:
        parent = self.fx.accept_issue(60, "shared-history.txt", "shared\n")
        left = self._branch_from(parent.sha, 61, "pkt-a.txt", "a\n")
        right = self._branch_from(parent.sha, 62, "pkt-b.txt", "b\n")
        self.assertEqual(_merge_base(self.fx.work, left.sha, right.sha), parent.sha)
        result = self.fx.assemble([left, right])
        self.assertEqual(result["action"], "created")
        for sha in (left.sha, right.sha):
            self.assertEqual(
                subprocess.run(
                    ["git", "merge-base", "--is-ancestor", sha, result["headSha"]],
                    cwd=self.fx.work,
                    check=False,
                ).returncode,
                0,
            )

    def test_unique_path_collision_after_shared_parent_still_overlaps(self) -> None:
        parent = self.fx.accept_issue(63, "shared-history.txt", "shared\n")
        left = self._branch_from(parent.sha, 64, "same.txt", "left\n")
        right = self._branch_from(parent.sha, 65, "same.txt", "right\n")
        with self.assertRaisesRegex(CoordinatorError, "overlapping_commits"):
            self.fx.assemble([left, right])

    def test_missing_local_issue_ref_still_assembles_from_remote_tip(self) -> None:
        parent = self.fx.accept_issue(66, "shared-history.txt", "shared\n")
        left = self._branch_from(parent.sha, 67, "remote-a.txt", "a\n")
        right = self._branch_from(parent.sha, 68, "remote-b.txt", "b\n")
        git(self.fx.work, "branch", "-D", left.branch)
        git(self.fx.work, "branch", "-D", right.branch)
        result = self.fx.assemble([left, right])
        self.assertEqual(result["action"], "created")


if __name__ == "__main__":
    unittest.main()

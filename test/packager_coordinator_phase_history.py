"""Focused regression tests for accepted multi-commit Phase history."""

from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path

from scripts.gitops.packager_coordinator import _unique_phase_commits


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


if __name__ == "__main__":
    unittest.main()

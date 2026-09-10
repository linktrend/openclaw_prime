"""Consumer acceptance fixtures for IDE v2.5 change-scoped secret scanning.

This file records the controller contract; it does not implement a local scan
bypass. The central controller must bind every acceptance decision to the
identity below before reusing inherited baseline evidence.
"""

from __future__ import annotations

import hashlib
import unittest

from scripts.gitops.secret_scan import (
    RULE_FORMAT_CLOUD,
    RULE_FORMAT_DATABASE,
    RULE_FORMAT_GITHUB,
    RULE_FORMAT_HIGH_ENTROPY,
    RULE_FORMAT_PEM,
    RULE_FORMAT_SK,
    scan_text,
)


BASELINE_COMMIT = "455b8c6402a4a6cffc94554addeec7bd07447b67"
BASELINE_TREE = "268e627f99919c1d9f86b7eb00bd91bdbb7a545e"
CANDIDATE_COMMIT = "9ccc909e4be2c7b1d9d3d70771aee0e4a564e3e8"
CANDIDATE_TREE = "4ab0c9891d9e66d2d40c5c1f8c02a3d06cfd21cc"
CANDIDATE_CONTENT_TREE = "b24359214af4992257c811cb901c575bb1c6e986"
SCOPE_CONFIG_DIGEST = "sha256:cca880817a220c3e43ddea487785f9b76b1ed47e2595dfc2d27653b964a5af59"

CHANGED_PATHS = (
    ".github/linktrend-secret-scan-fixtures.json",
    ".ide-development/schemas/secret-scan-result.schema.json",
    ".ide-development/tests/test_fixture_aware_secret_scan.py",
    "scripts/gitops/secret_scan.py",
)

MANAGED_SCANNER_POLICY_PATHS = (
    ".cursor/rules/03-secrets-security.mdc",
    ".ide-development/config/delivery.json",
    ".ide-development/config/generated-output-closure.json",
    ".ide-development/content/doctrine/GENERATED-OUTPUT-CLOSURE.md",
    ".ide-development/content/doctrine/SECRET-SCAN-FIXTURES.md",
    ".ide-development/platforms/cursor/rules/03-secrets-security.mdc",
    ".ide-development/schemas/generated-output-closure.schema.json",
    ".ide-development/schemas/secret-scan-fixtures.schema.json",
    ".ide-development/schemas/secret-scan-result.schema.json",
    ".ide-development/tests/test_fixture_aware_secret_scan.py",
    "scripts/gitops/secret_scan.py",
)

SCOPED_PATHS = tuple(sorted(set(CHANGED_PATHS) | set(MANAGED_SCANNER_POLICY_PATHS)))
EXPECTED_CHANGED_FINDING_COUNT = 0
EXPECTED_SCOPED_FINDING_COUNT = 0

ACCEPTANCE_IDENTITY = {
    "repository": "linktrend/openclaw_prime",
    "baselineRef": "origin/development",
    "baselineCommit": BASELINE_COMMIT,
    "baselineTree": BASELINE_TREE,
    "candidateCommit": CANDIDATE_COMMIT,
    "candidateTree": CANDIDATE_TREE,
    "candidateContentTree": CANDIDATE_CONTENT_TREE,
    "scannerPolicyVersion": "secret-scan-policy/v1",
    "changedPaths": list(CHANGED_PATHS),
    "managedScannerPolicyPaths": list(MANAGED_SCANNER_POLICY_PATHS),
    "scopedPaths": list(SCOPED_PATHS),
    "scopeConfigDigest": SCOPE_CONFIG_DIGEST,
}


def _matches_exact_identity(observed: dict[str, object]) -> bool:
    """Model the controller's exact-equality reuse gate without side effects."""

    return observed == ACCEPTANCE_IDENTITY


class ChangeScopedSecretScanAcceptanceTests(unittest.TestCase):
    def test_identity_and_zero_finding_expectation_are_frozen(self) -> None:
        self.assertEqual(len(CHANGED_PATHS), 4)
        self.assertEqual(len(SCOPED_PATHS), 12)
        self.assertEqual(ACCEPTANCE_IDENTITY["candidateContentTree"], CANDIDATE_CONTENT_TREE)
        self.assertEqual(ACCEPTANCE_IDENTITY["scopeConfigDigest"], SCOPE_CONFIG_DIGEST)
        self.assertEqual(EXPECTED_CHANGED_FINDING_COUNT, 0)
        self.assertEqual(EXPECTED_SCOPED_FINDING_COUNT, 0)

    def test_stale_identity_config_and_path_set_are_rejected(self) -> None:
        for field, replacement in (
            ("baselineCommit", "a" * 40),
            ("baselineTree", "b" * 40),
            ("candidateCommit", "c" * 40),
            ("candidateTree", "d" * 40),
            ("candidateContentTree", "e" * 40),
            ("scannerPolicyVersion", "secret-scan-policy/other"),
            ("scopeConfigDigest", "sha256:" + ("0" * 64)),
        ):
            stale = dict(ACCEPTANCE_IDENTITY)
            stale[field] = replacement
            self.assertFalse(_matches_exact_identity(stale), field)

        changed_paths = dict(ACCEPTANCE_IDENTITY)
        changed_paths["scopedPaths"] = list(SCOPED_PATHS[:-1])
        self.assertFalse(_matches_exact_identity(changed_paths))

        extra_path = dict(ACCEPTANCE_IDENTITY)
        extra_path["scopedPaths"] = [*SCOPED_PATHS, "untrusted/extra.txt"]
        self.assertFalse(_matches_exact_identity(extra_path))

    def test_reference_syntax_does_not_create_a_changed_finding(self) -> None:
        text = "\n".join(
            (
                "token = " + "authContext.token",
                "token = " + '"gateway.remote.token"',
                "key = " + '"ordinary-name"',
                "url = " + "${CONFIG_URL}",
            )
        )
        self.assertEqual(scan_text("changed-reference.ts", text), [])

    def test_genuine_changed_credentials_remain_blocking(self) -> None:
        entropy = hashlib.sha256(b"change-scoped-credential-fixture").hexdigest() * 2
        cases = (
            ('token = "ghp_' + ("A" * 36) + '"', RULE_FORMAT_GITHUB),
            ('token = "sk-' + ("B" * 32) + '"', RULE_FORMAT_SK),
            (f'key = "{entropy}"', RULE_FORMAT_HIGH_ENTROPY),
            (
                ('url = "' + "postgres://" +
                 'fixture:placeholder@db.example.invalid:5432/app"'),
                RULE_FORMAT_DATABASE,
            ),
            ('key = "AKIA' + ("C" * 16) + '"', RULE_FORMAT_CLOUD),
            (("-" * 5) + "BEGIN " + "PRIVATE KEY" + ("-" * 5), RULE_FORMAT_PEM),
        )
        for text, expected_rule in cases:
            findings = scan_text("changed-credential-fixture.txt", text)
            self.assertTrue(
                any(row["rule"] == expected_rule for row in findings),
                expected_rule,
            )


if __name__ == "__main__":
    unittest.main()

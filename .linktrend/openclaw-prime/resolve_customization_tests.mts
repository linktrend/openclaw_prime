#!/usr/bin/env node
/**
 * Fork-owned planner: exact base-to-head paths through resolveChangedTestTargetPlan.
 * Refuses broad/unresolved plans before any test runner starts.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolveChangedTestTargetPlan } from "../../scripts/test-projects.test-support.mts";

const HEX40 = /^[0-9a-f]{40}$/;
const REPO_REL =
  /^(?!\/|\\)(?!.*\.\.(?:\/|\\|$))(?!.*:)[A-Za-z0-9._@+, \-]+(?:\/[A-Za-z0-9._@+, \-]+)*$/;
const CODE_SUFFIX = /\.(?:[cm]?[jt]sx?)$/;
const BROAD_MARKERS = ["broad local run will start", "buildFullSuiteVitestRunPlans", '"mode":"broad"'];

function fail(reason: string, extra: Record<string, unknown> = {}): never {
  process.stderr.write(`${JSON.stringify({ ok: false, reason, ...extra })}\n`);
  process.exit(1);
}

function parseRef(flag: string, args: string[]): string {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith("-")) {
    fail("phase_identity");
  }
  return value;
}

function git(root: string, ...gitArgs: string[]): string {
  const result = spawnSync("git", gitArgs, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    fail("phase_diff", { detail: (result.stderr || result.stdout || "git failed").trim() });
  }
  return result.stdout.trim();
}

function resolveCommit(root: string, ref: string): string {
  const commit = git(root, "rev-parse", "--verify", `${ref}^{commit}`);
  if (!HEX40.test(commit)) {
    fail("phase_identity");
  }
  return commit;
}

function listNormalizedPaths(root: string, baseline: string, head: string): string[] {
  const renameOut = git(root, "diff", "--name-status", "--find-renames", baseline, head);
  for (const line of renameOut.split("\n")) {
    if (!line) {
      continue;
    }
    const status = line.split("\t", 1)[0] ?? "";
    if (status.startsWith("R") || status.startsWith("C")) {
      fail("unresolved_rename");
    }
  }
  const statusOut = git(root, "diff", "--name-only", "--no-renames", baseline, head);
  const paths = [...new Set(statusOut.split("\n").map((line) => line.trim()).filter(Boolean))].sort();
  for (const path of paths) {
    if (!REPO_REL.test(path) || path.startsWith("-")) {
      fail("unsafe_path", { path });
    }
  }
  return paths;
}

function codeChangesRequireTests(paths: string[]): boolean {
  return paths.some((path) => CODE_SUFFIX.test(path));
}

function canonicalDigest(value: unknown): string {
  const serialized = JSON.stringify(value);
  return `sha256:${createHash("sha256").update(serialized).digest("hex")}`;
}

function main(): void {
  const args = process.argv.slice(2);
  const root = process.cwd();
  const baseline = resolveCommit(root, parseRef("--base", args));
  const head = resolveCommit(root, parseRef("--head", args));
  const changedPaths = listNormalizedPaths(root, baseline, head);
  const plan = resolveChangedTestTargetPlan(changedPaths, { cwd: root, broad: false });
  const targets = [...new Set(plan.targets ?? [])];
  const skipped = plan.skippedBroadFallbackPaths ?? [];
  const payload = {
    schemaVersion: 1,
    kind: "customization-test-target-plan",
    mode: plan.mode,
    targets,
    skippedBroadFallbackPaths: skipped,
    changedPaths,
    changedPathsDigest: canonicalDigest(changedPaths),
    baselineCommit: baseline,
    headCommit: head,
  };
  const serialized = JSON.stringify(payload);
  if (BROAD_MARKERS.some((marker) => serialized.includes(marker))) {
    fail("relevant_tests_broadened", { plan: payload });
  }
  if (plan.mode !== "targets") {
    fail("relevant_tests_broadened", { plan: payload });
  }
  if (skipped.length > 0) {
    fail("relevant_tests_broadened", { plan: payload });
  }
  for (const target of targets) {
    if (!REPO_REL.test(target) || target.startsWith("-") || target === "--changed") {
      fail("relevant_tests_unresolved", { target, plan: payload });
    }
  }
  if (codeChangesRequireTests(changedPaths) && targets.length === 0) {
    fail("relevant_tests_unresolved", { plan: payload });
  }
  process.stdout.write(`${serialized}\n`);
}

main();

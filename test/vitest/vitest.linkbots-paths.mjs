// Narrow allowlist of tracked linkbots tests owned by the tooling Vitest lane.
// Keep this exact-file only: a directory glob would pull unpaid or live Lisa ops tests.
export const approvedLinkbotsToolingTestFiles = [
  "linkbots/lisa/ops/model-routing.test.ts",
  "linkbots/lisa/ops/google-workspace/google-workspace.test.ts",
];

const approvedLinkbotsToolingTestFileSet = new Set(approvedLinkbotsToolingTestFiles);

export function isApprovedLinkbotsToolingTestFile(value) {
  return approvedLinkbotsToolingTestFileSet.has(value.replaceAll("\\", "/"));
}

function importerIsApprovedLinkbotsToolingTest(importer) {
  if (typeof importer !== "string") {
    return false;
  }
  const normalized = importer.replaceAll("\\", "/");
  return approvedLinkbotsToolingTestFiles.some(
    (file) => normalized === file || normalized.endsWith(`/${file}`),
  );
}

export function rewriteApprovedLinkbotsNodeTestImport(code, id) {
  if (!importerIsApprovedLinkbotsToolingTest(id) || !code.includes("node:test")) {
    return null;
  }
  return code.replaceAll(/from\s+["']node:test["']/gu, 'from "vitest"');
}

// Vitest collects describe/it from its own module. Approved Lisa tests still
// import node:test; rewrite only those files so sibling linkbots tests and
// tooling files that import node:test mock stay on Node.
export function createApprovedLinkbotsNodeTestAliasPlugin() {
  return {
    name: "openclaw-approved-linkbots-node-test",
    enforce: "pre",
    transform(code, id) {
      const rewritten = rewriteApprovedLinkbotsNodeTestImport(code, id);
      return rewritten === null ? null : { code: rewritten, map: null };
    },
  };
}

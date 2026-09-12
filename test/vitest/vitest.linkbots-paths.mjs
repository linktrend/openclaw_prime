// Narrow allowlist of tracked linkbots tests owned by the tooling Vitest lane.
// Keep this exact-file only: a directory glob would pull unpaid or live Lisa ops tests.
export const approvedLinkbotsToolingTestFiles = ["linkbots/lisa/ops/model-routing.test.ts"];

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

// Vitest collects describe/it from its own module. Approved Lisa tests still
// import node:test; remap only those importers so sibling linkbots files stay
// on the Node test runner.
export function createApprovedLinkbotsNodeTestAliasPlugin() {
  return {
    name: "openclaw-approved-linkbots-node-test",
    enforce: "pre",
    resolveId(source, importer) {
      if (source !== "node:test" || !importerIsApprovedLinkbotsToolingTest(importer)) {
        return null;
      }
      return this.resolve("vitest", importer, { skipSelf: true });
    },
  };
}

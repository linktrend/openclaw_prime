// Narrow allowlist of tracked linkbots tests owned by the tooling Vitest lane.
// Keep this exact-file only: a directory glob would pull unpaid or live Lisa ops tests.
export const approvedLinkbotsToolingTestFiles = ["linkbots/lisa/ops/model-routing.test.ts"];

const approvedLinkbotsToolingTestFileSet = new Set(approvedLinkbotsToolingTestFiles);

export function isApprovedLinkbotsToolingTestFile(value) {
  return approvedLinkbotsToolingTestFileSet.has(value.replaceAll("\\", "/"));
}

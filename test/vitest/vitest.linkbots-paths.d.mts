export const approvedLinkbotsToolingTestFiles: string[];
export function isApprovedLinkbotsToolingTestFile(file: string): boolean;
export function rewriteApprovedLinkbotsNodeTestImport(code: string, id: string): string | null;
export function createApprovedLinkbotsNodeTestAliasPlugin(): {
  name: string;
  enforce: "pre";
  transform(code: string, id: string): { code: string; map: null } | null;
};

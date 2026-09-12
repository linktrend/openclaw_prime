export const approvedLinkbotsToolingTestFiles: string[];
export function isApprovedLinkbotsToolingTestFile(file: string): boolean;
export function createApprovedLinkbotsNodeTestAliasPlugin(): {
  name: string;
  enforce: "pre";
  resolveId(
    this: { resolve(source: string, importer?: string, options?: { skipSelf?: boolean }): unknown },
    source: string,
    importer?: string,
  ): unknown;
};

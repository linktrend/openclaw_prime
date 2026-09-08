/** Type declarations for Skills fake prohibited-field helpers. */
export declare const PROHIBITED_EXACT_KEYS: readonly string[];
export declare function isProhibitedKey(key: string): boolean;
export declare function findProhibitedField(
  value: unknown,
  path?: string,
): { path: string; key: string } | null;

/** Parser limits and allowlist options for plain-text tool-call repair. */
export type PlainTextToolCallParseOptions = {
  /** Optional allowlist of tool names that may be repaired. */
  allowedToolNames?: Iterable<string>;
  /** Maximum serialized payload size accepted for one repaired call. */
  maxPayloadBytes?: number;
};

export type NormalizedPlainTextToolCallParseOptions = Omit<
  PlainTextToolCallParseOptions,
  "allowedToolNames"
> & { allowedToolNames?: ReadonlySet<string> };

export function normalizeStandaloneParseOptions(
  options?: PlainTextToolCallParseOptions,
): NormalizedPlainTextToolCallParseOptions | undefined {
  return options
    ? {
        ...options,
        allowedToolNames: options.allowedToolNames ? new Set(options.allowedToolNames) : undefined,
      }
    : undefined;
}

export function skipMarkdownFence(text: string, start: number): number {
  const fence = text.slice(start).match(/^```(?:json)?[ \t]*(?:\r\n|\n|\r)/u);
  return fence ? start + fence[0].length : start;
}

export function skipMarkdownFenceClose(text: string, start: number): number {
  const fence = text.slice(start).match(/^```[ \t]*(?:\r\n|\n|\r|$)/u);
  return fence ? start + fence[0].length : start;
}

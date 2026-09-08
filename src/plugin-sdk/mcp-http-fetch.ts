/**
 * Plugin-facing MCP HTTP fetch: SSRF-guarded HTTPS with same-origin header helpers.
 *
 * Thin re-export of the core agents MCP fetch contract so extensions never import
 * `src/agents/**`. Prefer this for SSE / Streamable HTTP MCP client transports.
 *
 * Response bodies (ordinary JSON, SSE, Streamable HTTP) are capped at
 * {@link MCP_HTTP_MAX_RESPONSE_BYTES} (16 MiB). Caller `maxResponseBytes` may
 * only reduce that host ceiling; larger values clamp. Invalid values fail closed.
 */
export {
  buildMcpHttpFetch as buildPluginMcpHttpFetch,
  MCP_HTTP_MAX_RESPONSE_BYTES,
  withoutMcpAuthorizationHeader,
  withSameOriginMcpHttpHeaders,
} from "../agents/mcp-http-fetch.js";

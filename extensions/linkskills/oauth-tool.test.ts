import { describe, expect, it, vi } from "vitest";
import { createLinkskillsTool } from "./src/oauth-tool.js";

const assertionKeyRef = {
  source: "env" as const,
  provider: "default",
  id: "LINKTREND_SKILLS_ASSERTION_PEM",
};

function machineTokenConfig() {
  return {
    bindingId: "linkskills-production",
    issuerUrl: "https://issuer.example.test",
    clientId: "skills-client",
    clientAssertionKeyRef: assertionKeyRef,
  };
}

function createApi(params: {
  pluginConfig: Record<string, unknown>;
  acquire?: (options: {
    bindingId: string;
    signal?: AbortSignal;
    forceRefresh?: boolean;
  }) => Promise<{
    bindingId: string;
    bindingFingerprint: string;
    accessToken: string;
    expiresAt: number;
    tokenType: "Bearer";
  }>;
  invalidate?: (bindingId: string) => void;
}) {
  return {
    pluginConfig: params.pluginConfig,
    config: {},
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    ...(params.acquire
      ? {
          machineTokenFacade: {
            pluginId: "linkskills",
            grantedBindingIds: new Set(["linkskills-production"]),
            acquire: params.acquire,
            invalidate: params.invalidate ?? vi.fn(),
            health: () => ({
              pluginId: "linkskills",
              bindingId: "linkskills-production",
              granted: true,
              registered: true,
              cached: false,
            }),
            unregister: vi.fn(),
          },
        }
      : {}),
  } as never;
}

function httpConfig(overrides: Record<string, unknown> = {}) {
  return {
    transportMode: "http",
    environment: "production",
    skillsEndpoint: "http://127.0.0.1:18788",
    allowProductionLoopbackHttp: true,
    mcpDiscoveryRead: true,
    governedExecution: true,
    machineToken: machineTokenConfig(),
    ...overrides,
  };
}

function resolvedToken(bindingId: string) {
  return {
    bindingId,
    bindingFingerprint: `fp-${bindingId}`,
    accessToken: "test-access-token",
    expiresAt: Date.now() + 60_000,
    tokenType: "Bearer" as const,
  };
}

describe("linkskills native OAuth bridge", () => {
  it("calls the production loopback HTTP Gateway with a host-owned machine token", async () => {
    const acquire = vi.fn(async ({ bindingId }: { bindingId: string }) => resolvedToken(bindingId));
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("http://127.0.0.1:18788/v1/skills_tool_invoke");
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer test-access-token");
      const idempotencyKey = headers.get("idempotency-key");
      expect(idempotencyKey).toMatch(/^openclaw:[a-f0-9-]{36}$/u);
      expect(headers.get("x-request-id")).toBe(idempotencyKey);
      expect(JSON.parse(String(init?.body))).toEqual({
        params: { tool_id: "published.echo", input: { text: "hello" } },
        idempotency_key: idempotencyKey,
        request_id: idempotencyKey,
      });
      return new Response(JSON.stringify({ ok: true, data: { output: "hello" } }), {
        status: 200,
      });
    });
    const tool = createLinkskillsTool(createApi({ pluginConfig: httpConfig(), acquire }), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await tool.execute("tool-call-1", {
      operation: "skills_tool_invoke",
      arguments: { tool_id: "published.echo", input: { text: "hello" } },
    });

    expect(result.details).toMatchObject({ ok: true });
    expect(JSON.stringify(result)).not.toContain("test-access-token");
    expect(acquire).toHaveBeenCalledWith({ bindingId: "linkskills-production" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("uses a fresh request identity when tool-call IDs repeat across sessions", async () => {
    const acquire = vi.fn(async ({ bindingId }: { bindingId: string }) => resolvedToken(bindingId));
    const requestIds: string[] = [];
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requestIds.push(new Headers(init?.headers).get("idempotency-key") ?? "");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const tool = createLinkskillsTool(createApi({ pluginConfig: httpConfig(), acquire }), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await tool.execute("reused-tool-call", {
      operation: "skills_tool_invoke",
      arguments: { tool_id: "published.echo", input: { text: "first" } },
    });
    await tool.execute("reused-tool-call", {
      operation: "skills_tool_invoke",
      arguments: { tool_id: "published.echo", input: { text: "second" } },
    });

    expect(requestIds).toHaveLength(2);
    expect(requestIds[0]).not.toBe(requestIds[1]);
  });

  it.each([401, 403])("refreshes HTTP machine auth exactly once after %i", async (status) => {
    const acquire = vi.fn(async (options: { bindingId: string; forceRefresh?: boolean }) =>
      resolvedToken(options.bindingId),
    );
    const invalidate = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("denied", { status }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const tool = createLinkskillsTool(
      createApi({ pluginConfig: httpConfig(), acquire, invalidate }),
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    const result = await tool.execute("tool-call-refresh", {
      operation: "skills_search",
      arguments: { query: "approved" },
    });

    expect(result.details).toMatchObject({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith("linkskills-production");
    expect(acquire).toHaveBeenCalledTimes(2);
    expect(acquire.mock.calls[1]?.[0]).toMatchObject({ forceRefresh: true });
  });

  it("does not retry again when refreshed HTTP machine auth is rejected", async () => {
    const acquire = vi.fn(async ({ bindingId }: { bindingId: string }) => resolvedToken(bindingId));
    const invalidate = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(new Response("denied", { status: 401 }));
    const tool = createLinkskillsTool(
      createApi({ pluginConfig: httpConfig(), acquire, invalidate }),
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    const result = await tool.execute("tool-call-refresh-denied", {
      operation: "skills_search",
      arguments: { query: "approved" },
    });

    expect(result.content[0]?.text).toBe(
      "LiNKskills request failed: linkskills request failed (HTTP 401)",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(acquire).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("fail-closes when the HTTP native bridge has no machine-token binding", async () => {
    const fetchImpl = vi.fn();
    const tool = createLinkskillsTool(
      createApi({
        pluginConfig: httpConfig({
          machineToken: undefined,
          skillsCredential: "test-skills-credential",
        }),
      }),
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    const result = await tool.execute("tool-call-no-auth", {
      operation: "skills_list",
      arguments: {},
    });

    expect(result.content[0]?.text).toBe(
      "LiNKskills request failed: linkskills authentication is unavailable",
    );
    expect(JSON.stringify(result)).not.toContain("test-skills-credential");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects production loopback HTTP unless explicitly enabled", async () => {
    const acquire = vi.fn(async ({ bindingId }: { bindingId: string }) => resolvedToken(bindingId));
    const fetchImpl = vi.fn();
    const tool = createLinkskillsTool(
      createApi({
        pluginConfig: httpConfig({ allowProductionLoopbackHttp: false }),
        acquire,
      }),
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    const result = await tool.execute("tool-call-loopback", {
      operation: "skills_list",
      arguments: {},
    });

    expect(result).toMatchObject({ details: { ok: false, reason: "configuration_unavailable" } });
    expect(acquire).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("enforces feature gates before opening the HTTP transport", async () => {
    const acquire = vi.fn(async ({ bindingId }: { bindingId: string }) => resolvedToken(bindingId));
    const fetchImpl = vi.fn();
    const tool = createLinkskillsTool(
      createApi({ pluginConfig: httpConfig({ mcpDiscoveryRead: false }), acquire }),
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    const result = await tool.execute("tool-call-disabled", {
      operation: "skills_search",
      arguments: { query: "test" },
    });

    expect(result).toMatchObject({ details: { ok: false, reason: "disabled" } });
    expect(acquire).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects operations outside the native discovery and governed allowlists", async () => {
    const acquire = vi.fn(async ({ bindingId }: { bindingId: string }) => resolvedToken(bindingId));
    const fetchImpl = vi.fn();
    const tool = createLinkskillsTool(createApi({ pluginConfig: httpConfig(), acquire }), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await tool.execute("tool-call-forbidden", {
      operation: "skills_run_start",
      arguments: {},
    });

    expect(result).toMatchObject({
      details: { ok: false, reason: "operation_not_allowed" },
    });
    expect(acquire).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects model-supplied actor identity before opening a transport", async () => {
    const tool = createLinkskillsTool(
      createApi({ pluginConfig: { mcpDiscoveryRead: true, transportMode: "mcp" } }),
    );
    const result = await tool.execute("test", {
      operation: "skills_search",
      arguments: { query: "test", actor_id: "spoofed" },
    });
    expect(result.content[0]?.text).toBe("Actor identity is assigned by LiNKskills.");
  });
});

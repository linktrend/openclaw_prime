import { describe, expect, it, vi } from "vitest";
import { parseLinkbrainConfig } from "./src/config.js";
import { callLinkbrainMcpTool, resolveLinkbrainTransport } from "./src/transport.js";

function stubApi(config: Record<string, unknown> = {}) {
  return {
    config: config as never,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
}

const assertionKeyRef = {
  source: "env" as const,
  provider: "default",
  id: "LINKTREND_BRAIN_ASSERTION_PEM",
};

const writeArgs = {
  toolName: "brain_capture_batch",
  idempotencyKey: "idem:test-1",
  arguments: { batch: { batchId: "b1" } },
};

describe("linkbrain transport modes", () => {
  it("allows only the exact opted-in production Brain MCP loopback for reads and writes", async () => {
    const acquire = vi.fn(async ({ bindingId }) => ({
      bindingId,
      bindingFingerprint: `fp-${bindingId}`,
      accessToken: "fixture",
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const machineTokenFacade = {
      pluginId: "linkbrain",
      grantedBindingIds: new Set(["linkbrain-production"]),
      acquire,
      invalidate: vi.fn(),
      health: () => ({
        pluginId: "linkbrain",
        bindingId: "linkbrain-production",
        granted: true,
        registered: true,
        cached: false,
      }),
      unregister: vi.fn(),
    };
    const config = parseLinkbrainConfig({
      transportMode: "mcp",
      environment: "production",
      allowProductionLoopbackHttp: true,
      machineToken: {
        bindingId: "linkbrain-production",
        issuerUrl: "https://issuer.example.test",
        clientId: "brain-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const apiConfig = {
      mcp: {
        servers: {
          linkbrain: {
            enabled: true,
            url: "http://127.0.0.1:18789/mcp",
            auth: "machine_token",
          },
        },
      },
    };
    const readCall = vi.fn(async () => ({ structuredContent: { items: [] } }));
    await expect(
      callLinkbrainMcpTool({
        api: { ...stubApi(apiConfig), machineTokenFacade },
        config,
        toolName: "brain_browse",
        arguments: {},
        createMcpSession: async () => ({ callTool: readCall, close: async () => undefined }),
      }),
    ).resolves.toEqual({ ok: true, result: { items: [] } });

    const writeCall = vi.fn(async () => ({ structuredContent: { accepted: true } }));
    const transport = resolveLinkbrainTransport({
      api: { ...stubApi(apiConfig), machineTokenFacade },
      config,
      createMcpSession: async () => ({ callTool: writeCall, close: async () => undefined }),
    });
    await expect(transport.write(writeArgs)).resolves.toMatchObject({ ok: true });
    expect(readCall).toHaveBeenCalledWith("brain_browse", {});
    expect(writeCall).toHaveBeenCalledWith("brain_capture_batch", writeArgs.arguments);
    expect(acquire).toHaveBeenCalled();
  });

  it.each([
    ["flag disabled", "production", false, "http://127.0.0.1:18789/mcp"],
    ["stage ignores flag", "stage", true, "http://127.0.0.1:18789/mcp"],
    ["localhost name", "production", true, "http://localhost:18789/mcp"],
    ["IPv6 loopback", "production", true, "http://[::1]:18789/mcp"],
    ["IPv4-mapped loopback", "production", true, "http://[::ffff:127.0.0.1]:18789/mcp"],
    ["other loopback", "production", true, "http://127.0.0.2:18789/mcp"],
    ["wrong port", "production", true, "http://127.0.0.1:18790/mcp"],
    ["wrong path", "production", true, "http://127.0.0.1:18789/other"],
    ["normalized path", "production", true, "http://127.0.0.1:18789/x/../mcp"],
    ["trailing slash", "production", true, "http://127.0.0.1:18789/mcp/"],
    ["query", "production", true, "http://127.0.0.1:18789/mcp?debug=1"],
    ["fragment", "production", true, "http://127.0.0.1:18789/mcp#debug"],
    ["private LAN", "production", true, "http://192.168.1.5:18789/mcp"],
    ["public HTTP", "production", true, "http://brain.example.test/mcp"],
  ])("rejects production MCP HTTP variant: %s", async (_label, environment, flag, url) => {
    const config = parseLinkbrainConfig({
      transportMode: "mcp",
      environment,
      allowProductionLoopbackHttp: flag,
    });
    const createMcpSession = vi.fn();
    const result = await callLinkbrainMcpTool({
      api: stubApi({ mcp: { servers: { linkbrain: { enabled: true, url } } } }),
      config,
      toolName: "brain_browse",
      arguments: {},
      createMcpSession,
    });
    expect(result).toEqual({ ok: false, safeMessage: "linkbrain MCP endpoint is rejected" });
    expect(createMcpSession).not.toHaveBeenCalled();
  });

  it("calls allowlisted knowledge through the host machine-token facade only", async () => {
    const acquire = vi.fn(async ({ bindingId }) => ({
      bindingId,
      bindingFingerprint: `fp-${bindingId}`,
      accessToken: "not-exposed-to-model",
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const config = parseLinkbrainConfig({
      transportMode: "mcp",
      machineToken: {
        bindingId: "linkbrain-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "brain-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const callTool = vi.fn(async () => ({ structuredContent: { items: [] } }));
    const result = await callLinkbrainMcpTool({
      api: {
        ...stubApi({
          mcp: {
            servers: {
              linkbrain: {
                enabled: true,
                url: "https://brain.example.test/mcp",
                auth: "machine_token",
              },
            },
          },
        }),
        machineTokenFacade: {
          pluginId: "linkbrain",
          grantedBindingIds: new Set(["linkbrain-stage"]),
          acquire,
          invalidate: vi.fn(),
          health: () => ({
            pluginId: "linkbrain",
            bindingId: "linkbrain-stage",
            granted: true,
            registered: true,
            cached: false,
          }),
          unregister: vi.fn(),
        },
      },
      config,
      toolName: "brain_search",
      arguments: { query: "approved test" },
      createMcpSession: async () => ({ callTool, close: async () => undefined }),
    });
    expect(result).toEqual({ ok: true, result: { items: [] } });
    expect(acquire).toHaveBeenCalledWith(expect.objectContaining({ bindingId: "linkbrain-stage" }));
    expect(callTool).toHaveBeenCalledWith("brain_search", { query: "approved test" });
  });

  it("defaults transportMode to disabled and returns transport_disabled", async () => {
    const config = parseLinkbrainConfig({});
    expect(config.transportMode).toBe("disabled");
    expect(config.mcpServerName).toBe("linkbrain");
    const transport = resolveLinkbrainTransport({
      api: stubApi(),
      config,
    });
    const result = await transport.write(writeArgs);
    expect(result).toMatchObject({
      ok: false,
      retryable: true,
      errorCode: "transport_disabled",
    });
    expect(result.errorCode).not.toBe("not_configured");
  });

  it("rejects fake outside test environment", async () => {
    const config = parseLinkbrainConfig({
      transportMode: "fake",
      environment: "production",
    });
    const transport = resolveLinkbrainTransport({
      api: stubApi(),
      config,
    });
    const result = await transport.write(writeArgs);
    expect(result).toMatchObject({
      ok: false,
      terminal: true,
      errorCode: "fake_rejected",
    });
  });

  it("accepts fake via explicit test injection", async () => {
    const config = parseLinkbrainConfig({
      transportMode: "fake",
      environment: "test",
    });
    const transport = resolveLinkbrainTransport({
      api: stubApi(),
      config,
      fakeForTests: {
        callTool: () => ({ ok: true, result: { accepted: true } }),
      },
    });
    const result = await transport.write(writeArgs);
    expect(result).toMatchObject({ ok: true, result: { accepted: true } });
  });

  it("http mode posts with SecretRef bearer from env", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer fake-brain-token");
      const rawBody = init?.body;
      const bodyText =
        typeof rawBody === "string"
          ? rawBody
          : rawBody instanceof Uint8Array
            ? Buffer.from(rawBody).toString("utf8")
            : rawBody == null
              ? ""
              : JSON.stringify(rawBody);
      const body = JSON.parse(bodyText) as { toolName: string };
      expect(body.toolName).toBe("brain_capture_batch");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const config = parseLinkbrainConfig({
      transportMode: "http",
      ingestionEndpoint: "https://brain.example.test/ingest",
      ingestionCredential: {
        source: "env",
        provider: "default",
        id: "LINKTREND_BRAIN_FAKE_TOKEN",
      },
    });
    const transport = resolveLinkbrainTransport({
      api: stubApi(),
      config,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      env: { LINKTREND_BRAIN_FAKE_TOKEN: "fake-brain-token" },
    });
    const result = await transport.write(writeArgs);
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("http mode maps 503 to retryable and 401 to terminal", async () => {
    const config = parseLinkbrainConfig({
      transportMode: "http",
      ingestionEndpoint: "https://brain.example.test/ingest",
      ingestionCredential: "plain-fake-token",
    });
    const fetch503 = vi.fn(async () => new Response("busy", { status: 503 }));
    const transport503 = resolveLinkbrainTransport({
      api: stubApi(),
      config,
      fetchImpl: fetch503 as unknown as typeof fetch,
    });
    expect(await transport503.write(writeArgs)).toMatchObject({
      ok: false,
      retryable: true,
      errorCode: "retryable",
    });

    const fetch401 = vi.fn(async () => new Response("nope", { status: 401 }));
    const transport401 = resolveLinkbrainTransport({
      api: stubApi(),
      config,
      fetchImpl: fetch401 as unknown as typeof fetch,
    });
    expect(await transport401.write(writeArgs)).toMatchObject({
      ok: false,
      terminal: true,
      errorCode: "authentication",
    });
  });

  it("rejects non-HTTPS ingestionEndpoint outside local-test loopback", () => {
    expect(() =>
      parseLinkbrainConfig({
        transportMode: "http",
        environment: "production",
        ingestionEndpoint: "http://brain.example.test/ingest",
      }),
    ).toThrow(/HTTPS/);
    expect(() =>
      parseLinkbrainConfig({
        transportMode: "http",
        environment: "production",
        ingestionEndpoint: "http://10.0.0.5/ingest",
      }),
    ).toThrow(/HTTPS/);
  });

  it("mcp mode calls frozen tool names through injected session", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const config = parseLinkbrainConfig({
      transportMode: "mcp",
      mcpServerName: "linkbrain",
    });
    const transport = resolveLinkbrainTransport({
      api: stubApi({
        mcp: {
          servers: {
            linkbrain: {
              enabled: true,
              url: "https://mcp.example.test/brain",
              headers: {
                Authorization: "Bearer mcp-fake",
              },
            },
          },
        },
      }),
      config,
      createMcpSession: async () => ({
        async callTool(name, args) {
          calls.push({ name, args });
          return { structuredContent: { accepted: true } };
        },
        async close() {},
      }),
    });
    const result = await transport.write(writeArgs);
    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      {
        name: "brain_capture_batch",
        args: { batch: { batchId: "b1" } },
      },
    ]);
    expect(calls[0]?.args).not.toHaveProperty("idempotencyKey");
  });

  it("mcp oauth-only without SecretRef header returns auth_profile_required", async () => {
    const config = parseLinkbrainConfig({ transportMode: "mcp" });
    const transport = resolveLinkbrainTransport({
      api: stubApi({
        mcp: {
          servers: {
            linkbrain: {
              enabled: true,
              url: "https://mcp.example.test/brain",
              auth: "oauth",
              oauth: { authProfileId: "linkbrain-stage-mcp" },
            },
          },
        },
      }),
      config,
    });
    const result = await transport.write(writeArgs);
    expect(result).toMatchObject({
      ok: false,
      retryable: true,
      errorCode: "auth_profile_required",
    });
  });

  it("http mode posts with machineToken bearer via injected resolver", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer mt-brain-access");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const resolveMachineTokenAccess = vi.fn(async ({ bindingId }) => {
      expect(bindingId).toBe("linkbrain-stage");
      return {
        bindingId,
        bindingFingerprint: `fp-${bindingId}`,
        accessToken: "mt-brain-access",
        expiresAt: Date.now() + 60_000,
        tokenType: "Bearer" as const,
      };
    });
    const config = parseLinkbrainConfig({
      transportMode: "http",
      ingestionEndpoint: "https://brain.example.test/ingest",
      machineToken: {
        bindingId: "linkbrain-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "brain-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const transport = resolveLinkbrainTransport({
      api: stubApi(),
      config,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      env: { LINKTREND_BRAIN_ASSERTION_PEM: "PEM-BRAIN" },
      resolveMachineTokenAccess,
    });
    const result = await transport.write(writeArgs);
    expect(result.ok).toBe(true);
    expect(resolveMachineTokenAccess).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("http machineToken 401/403 invalidates cache and retries once", async () => {
    for (const status of [401, 403] as const) {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(new Response("nope", { status }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const invalidateMachineTokenCache = vi.fn();
      let resolveCount = 0;
      const resolveMachineTokenAccess = vi.fn(async ({ bindingId, forceRefresh }) => {
        resolveCount += 1;
        if (resolveCount === 2) {
          expect(forceRefresh).toBe(true);
        }
        return {
          bindingId,
          bindingFingerprint: `fp-${bindingId}`,
          accessToken: resolveCount === 1 ? "stale-token" : "fresh-token",
          expiresAt: Date.now() + 60_000,
          tokenType: "Bearer" as const,
        };
      });
      const config = parseLinkbrainConfig({
        transportMode: "http",
        ingestionEndpoint: "https://brain.example.test/ingest",
        machineToken: {
          bindingId: "linkbrain-stage",
          issuerUrl: "https://issuer.example.test",
          clientId: "brain-client",
          clientAssertionKeyRef: assertionKeyRef,
        },
      });
      const transport = resolveLinkbrainTransport({
        api: stubApi(),
        config,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        env: { LINKTREND_BRAIN_ASSERTION_PEM: "PEM-BRAIN" },
        resolveMachineTokenAccess,
        invalidateMachineTokenCache,
      });
      const result = await transport.write(writeArgs);
      expect(result.ok).toBe(true);
      expect(invalidateMachineTokenCache).toHaveBeenCalledWith("fp-linkbrain-stage");
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(new Headers(fetchImpl.mock.calls[1]![1]?.headers).get("authorization")).toBe(
        "Bearer fresh-token",
      );
    }
  });

  it("mcp machine_token injects bearer and does not return auth_profile_required", async () => {
    const seenHeaders: Array<Record<string, unknown> | undefined> = [];
    const resolveMachineTokenAccess = vi.fn(async ({ bindingId }) => ({
      bindingId,
      bindingFingerprint: `fp-${bindingId}`,
      accessToken: "mt-mcp-brain",
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const config = parseLinkbrainConfig({
      transportMode: "mcp",
      machineToken: {
        bindingId: "linkbrain-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "brain-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const transport = resolveLinkbrainTransport({
      api: stubApi({
        mcp: {
          servers: {
            linkbrain: {
              enabled: true,
              url: "https://mcp.example.test/brain",
              auth: "machine_token",
            },
          },
        },
      }),
      config,
      env: { LINKTREND_BRAIN_ASSERTION_PEM: "PEM-BRAIN" },
      resolveMachineTokenAccess,
      createMcpSession: async (server) => {
        seenHeaders.push(server.headers);
        return {
          async callTool() {
            return { structuredContent: { accepted: true } };
          },
          async close() {},
        };
      },
    });
    const result = await transport.write(writeArgs);
    expect(result.ok).toBe(true);
    expect(result.errorCode).not.toBe("auth_profile_required");
    expect(seenHeaders[0]).toMatchObject({ Authorization: "Bearer mt-mcp-brain" });
  });

  it("mcp machine_token 401/403 reissues once then succeeds", async () => {
    let sessionOpens = 0;
    const resolveMachineTokenAccess = vi.fn(async ({ bindingId, forceRefresh }) => ({
      bindingId,
      bindingFingerprint: `fp-${bindingId}`,
      accessToken: forceRefresh ? "fresh-mcp" : "stale-mcp",
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const invalidateMachineTokenCache = vi.fn();
    const config = parseLinkbrainConfig({
      transportMode: "mcp",
      machineToken: {
        bindingId: "linkbrain-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "brain-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const transport = resolveLinkbrainTransport({
      api: stubApi({
        mcp: {
          servers: {
            linkbrain: {
              enabled: true,
              url: "https://mcp.example.test/brain",
              auth: "machine_token",
            },
          },
        },
      }),
      config,
      env: { LINKTREND_BRAIN_ASSERTION_PEM: "PEM-BRAIN" },
      resolveMachineTokenAccess,
      invalidateMachineTokenCache,
      createMcpSession: async (server) => {
        sessionOpens += 1;
        const auth = (server.headers as Record<string, string> | undefined)?.Authorization;
        return {
          async callTool() {
            if (sessionOpens === 1) {
              const err = new Error("HTTP 401 unauthorized");
              (err as { status?: number }).status = 401;
              throw err;
            }
            expect(auth).toBe("Bearer fresh-mcp");
            return { structuredContent: { accepted: true } };
          },
          async close() {},
        };
      },
    });
    const result = await transport.write(writeArgs);
    expect(result.ok).toBe(true);
    expect(sessionOpens).toBe(2);
    expect(invalidateMachineTokenCache).toHaveBeenCalledOnce();
    expect(resolveMachineTokenAccess).toHaveBeenCalledTimes(2);
  });

  it("mcp oauth is not overridden by a present machineToken block", async () => {
    const resolveMachineTokenAccess = vi.fn(async ({ bindingId }) => ({
      bindingId,
      bindingFingerprint: `fp-${bindingId}`,
      accessToken: "mt-must-not-apply",
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const config = parseLinkbrainConfig({
      transportMode: "mcp",
      machineToken: {
        bindingId: "linkbrain-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "brain-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const transport = resolveLinkbrainTransport({
      api: stubApi({
        mcp: {
          servers: {
            linkbrain: {
              enabled: true,
              url: "https://mcp.example.test/brain",
              auth: "oauth",
              oauth: { authProfileId: "brain-oauth" },
              machineToken: {
                bindingId: "linkbrain-stage",
                issuerUrl: "https://issuer.example.test",
                clientId: "brain-client",
                clientAssertionKeyRef: assertionKeyRef,
              },
            },
          },
        },
      }),
      config,
      env: { LINKTREND_BRAIN_ASSERTION_PEM: "PEM-BRAIN" },
      resolveMachineTokenAccess,
      createMcpSession: async () => {
        throw new Error("should not open MCP session when oauth auth-profile is required");
      },
    });
    const result = await transport.write(writeArgs);
    expect(result).toMatchObject({
      ok: false,
      errorCode: "auth_profile_required",
    });
    expect(resolveMachineTokenAccess).not.toHaveBeenCalled();
  });

  it("mcp machine_token without complete binding fail-closes (no SecretRef fallthrough)", async () => {
    const config = parseLinkbrainConfig({
      transportMode: "mcp",
    });
    const transport = resolveLinkbrainTransport({
      api: stubApi({
        mcp: {
          servers: {
            linkbrain: {
              enabled: true,
              url: "https://mcp.example.test/brain",
              auth: "machine_token",
              headers: {
                Authorization: {
                  source: "env",
                  provider: "default",
                  id: "MUST_NOT_USE_SECRETREF_FALLTHROUGH",
                },
              },
            },
          },
        },
      }),
      config,
      env: { MUST_NOT_USE_SECRETREF_FALLTHROUGH: "secretref-bearer" },
      createMcpSession: async (server) => {
        expect(server.headers).not.toMatchObject({
          Authorization: "secretref-bearer",
        });
        return {
          async callTool() {
            return { structuredContent: { accepted: true } };
          },
          async close() {},
        };
      },
    });
    const result = await transport.write(writeArgs);
    expect(result).toMatchObject({
      ok: false,
      errorCode: "machine_token_error",
    });
  });

  async function writeWithInvalidServerMachineToken(params: {
    serverMachineToken: unknown;
    expectSafeMessage?: RegExp;
  }) {
    const resolveMachineTokenAccess = vi.fn(async ({ bindingId }) => ({
      bindingId,
      bindingFingerprint: `fp-${bindingId}`,
      accessToken: "mt-plugin-must-not-apply",
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const config = parseLinkbrainConfig({
      transportMode: "mcp",
      machineToken: {
        bindingId: "linkbrain-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "brain-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const transport = resolveLinkbrainTransport({
      api: stubApi({
        mcp: {
          servers: {
            linkbrain: {
              enabled: true,
              url: "https://mcp.example.test/brain",
              auth: "machine_token",
              machineToken: params.serverMachineToken,
            },
          },
        },
      }),
      config,
      env: { LINKTREND_BRAIN_ASSERTION_PEM: "PEM-BRAIN" },
      resolveMachineTokenAccess,
      createMcpSession: async () => {
        throw new Error("should not open MCP session for present-invalid machineToken");
      },
    });
    const result = await transport.write(writeArgs);
    expect(result).toMatchObject({
      ok: false,
      errorCode: "machine_token_error",
    });
    if (params.expectSafeMessage) {
      expect(result.safeMessage).toMatch(params.expectSafeMessage);
    }
    expect(resolveMachineTokenAccess).not.toHaveBeenCalled();
    return result;
  }

  it("mcp present-invalid malformed SecretRef fail-closes and does not use plugin binding", async () => {
    await writeWithInvalidServerMachineToken({
      serverMachineToken: {
        bindingId: "linkbrain-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "brain-client",
        clientAssertionKeyRef: {
          source: "env",
          provider: "default",
          // missing id → malformed SecretRef
        },
      },
      expectSafeMessage: /SecretRef/,
    });
  });

  it("mcp present-invalid bad issuer fail-closes and does not use plugin binding", async () => {
    await writeWithInvalidServerMachineToken({
      serverMachineToken: {
        bindingId: "linkbrain-stage",
        issuerUrl: "https://issuer.example.test/tenant",
        clientId: "brain-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
      expectSafeMessage: /issuerUrl|path/i,
    });
  });

  it("mcp present-invalid bad clientId fail-closes and does not use plugin binding", async () => {
    await writeWithInvalidServerMachineToken({
      serverMachineToken: {
        bindingId: "linkbrain-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "",
        clientAssertionKeyRef: assertionKeyRef,
      },
      expectSafeMessage: /clientId/,
    });
  });

  it("mcp present-invalid audience/scope fail-closes and does not use plugin binding", async () => {
    await writeWithInvalidServerMachineToken({
      serverMachineToken: {
        bindingId: "linkbrain-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "brain-client",
        clientAssertionKeyRef: assertionKeyRef,
        audience: "",
      },
      expectSafeMessage: /audience/,
    });
    await writeWithInvalidServerMachineToken({
      serverMachineToken: {
        bindingId: "linkbrain-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "brain-client",
        clientAssertionKeyRef: assertionKeyRef,
        scope: 42,
      },
      expectSafeMessage: /scope/,
    });
  });

  it("mcp present-invalid partial binding fail-closes and does not use plugin binding", async () => {
    await writeWithInvalidServerMachineToken({
      serverMachineToken: {
        bindingId: "linkbrain-stage",
        // missing issuerUrl, clientId, clientAssertionKeyRef
      },
      expectSafeMessage: /clientAssertionKeyRef|must be/,
    });
  });

  it("mcp conflicting server vs plugin machineToken bindings fail-closes", async () => {
    const resolveMachineTokenAccess = vi.fn(async ({ bindingId }) => ({
      bindingId,
      bindingFingerprint: `fp-${bindingId}`,
      accessToken: "mt-must-not-apply",
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const config = parseLinkbrainConfig({
      transportMode: "mcp",
      machineToken: {
        bindingId: "linkbrain-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "brain-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const transport = resolveLinkbrainTransport({
      api: stubApi({
        mcp: {
          servers: {
            linkbrain: {
              enabled: true,
              url: "https://mcp.example.test/brain",
              auth: "machine_token",
              machineToken: {
                bindingId: "linkbrain-other",
                issuerUrl: "https://issuer.example.test",
                clientId: "brain-client",
                clientAssertionKeyRef: {
                  source: "env",
                  provider: "default",
                  id: "LINKTREND_BRAIN_OTHER_PEM",
                },
              },
            },
          },
        },
      }),
      config,
      env: {
        LINKTREND_BRAIN_ASSERTION_PEM: "PEM-BRAIN",
        LINKTREND_BRAIN_OTHER_PEM: "PEM-OTHER",
      },
      resolveMachineTokenAccess,
      createMcpSession: async () => {
        throw new Error("should not open MCP session for conflicting machineToken bindings");
      },
    });
    const result = await transport.write(writeArgs);
    expect(result).toMatchObject({
      ok: false,
      errorCode: "machine_token_error",
      safeMessage: expect.stringMatching(/conflict/i),
    });
    expect(resolveMachineTokenAccess).not.toHaveBeenCalled();
  });

  it("mcp conflicting allowPrivateNetwork flags fail-closes", async () => {
    const resolveMachineTokenAccess = vi.fn(async ({ bindingId }) => ({
      bindingId,
      bindingFingerprint: `fp-${bindingId}`,
      accessToken: "mt-must-not-apply",
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const config = parseLinkbrainConfig({
      transportMode: "mcp",
      machineToken: {
        bindingId: "linkbrain-stage",
        issuerUrl: "https://linktrend-mini.tailf7e13a.ts.net:9443",
        clientId: "brain-client",
        allowPrivateNetwork: true,
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const transport = resolveLinkbrainTransport({
      api: stubApi({
        mcp: {
          servers: {
            linkbrain: {
              enabled: true,
              url: "https://mcp.example.test/brain",
              auth: "machine_token",
              machineToken: {
                bindingId: "linkbrain-stage",
                issuerUrl: "https://linktrend-mini.tailf7e13a.ts.net:9443",
                clientId: "brain-client",
                clientAssertionKeyRef: assertionKeyRef,
              },
            },
          },
        },
      }),
      config,
      env: {
        LINKTREND_BRAIN_ASSERTION_PEM: "PEM-BRAIN",
      },
      resolveMachineTokenAccess,
      createMcpSession: async () => {
        throw new Error("should not open MCP session for allowPrivateNetwork conflict");
      },
    });
    const result = await transport.write(writeArgs);
    expect(result).toMatchObject({
      ok: false,
      errorCode: "machine_token_error",
      safeMessage: expect.stringMatching(/conflict/i),
    });
    expect(resolveMachineTokenAccess).not.toHaveBeenCalled();
  });

  it("rejects literal PEM clientAssertionKeyRef in schema parse", () => {
    expect(() =>
      parseLinkbrainConfig({
        machineToken: {
          bindingId: "linkbrain-stage",
          issuerUrl: "https://issuer.example.test",
          clientId: "brain-client",
          clientAssertionKeyRef: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
        },
      }),
    ).toThrow(/SecretRef object/);
  });

  it("brain and skills machineToken fixtures use distinct bindingIds", () => {
    const brain = parseLinkbrainConfig({
      machineToken: {
        bindingId: "linkbrain-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "brain-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    // Skills fixture id must never equal Brain (independent cache domains).
    const skillsBindingId = "linkskills-stage";
    expect(brain.machineToken?.bindingId).toBe("linkbrain-stage");
    expect(brain.machineToken?.bindingId).not.toBe(skillsBindingId);
  });

  it("uses api.machineTokenFacade without local resolveMachineTokenAccess", async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const acquire = vi.fn(async ({ bindingId }) => ({
      bindingId,
      bindingFingerprint: `fp-${bindingId}`,
      accessToken: "host-injected-token",
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const facade = {
      pluginId: "linkbrain",
      grantedBindingIds: new Set(["linkbrain-stage"]),
      acquire,
      invalidate: vi.fn(),
      health: () => ({
        pluginId: "linkbrain",
        bindingId: "linkbrain-stage",
        granted: true,
        registered: true,
        cached: false,
      }),
      unregister: vi.fn(),
    };
    const config = parseLinkbrainConfig({
      transportMode: "http",
      ingestionEndpoint: "https://brain.example.test/ingest",
      machineToken: {
        bindingId: "linkbrain-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "brain-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const transport = resolveLinkbrainTransport({
      api: { ...stubApi(), machineTokenFacade: facade },
      config,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      env: { LINKTREND_BRAIN_ASSERTION_PEM: "PEM-BRAIN" },
    });
    const result = await transport.write(writeArgs);
    expect(result.ok).toBe(true);
    expect(acquire).toHaveBeenCalledOnce();
    const fetchCalls = fetchImpl.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>;
    expect(new Headers(fetchCalls[0]?.[1]?.headers).get("authorization")).toBe(
      "Bearer host-injected-token",
    );
  });

  it("fail-closes when machineToken is configured without an injected facade", async () => {
    const config = parseLinkbrainConfig({
      transportMode: "http",
      ingestionEndpoint: "https://brain.example.test/ingest",
      machineToken: {
        bindingId: "linkbrain-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "brain-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const transport = resolveLinkbrainTransport({
      api: stubApi(),
      config,
      env: { LINKTREND_BRAIN_ASSERTION_PEM: "PEM-BRAIN" },
    });
    const result = await transport.write(writeArgs);
    expect(result).toMatchObject({
      ok: false,
      errorCode: "machine_token_error",
      safeMessage: expect.stringMatching(/facade is not configured/i),
    });
  });

  it("mcp managed machine_token strip Authorization from requestInit shape via withoutMcpAuthorizationHeader", async () => {
    const { withoutMcpAuthorizationHeader } = await import("openclaw/plugin-sdk/mcp-http-fetch");
    expect(
      withoutMcpAuthorizationHeader({
        Authorization: "Bearer must-not-persist",
        "x-openclaw": "1",
      }),
    ).toEqual({ "x-openclaw": "1" });
  });
});

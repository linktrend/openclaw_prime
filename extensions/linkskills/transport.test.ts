import { describe, expect, it, vi } from "vitest";
import { parseLinkskillsConfig } from "./src/config.js";
import { findProhibitedSkillsField } from "./src/envelopes.js";
import { mapSkillsEventTypeToToolName, resolveSkillsDrainToolName } from "./src/tools.js";
import {
  buildLinkskillsHttpOperationUrl,
  callLinkskillsMcpTool,
  resolveLinkskillsTransport,
} from "./src/transport.js";

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

const sampleEnvelope = {
  version: 1 as const,
  kind: "structured_event" as const,
  toolName: "skills_run_start",
  idempotencyKey: "idem:skills-1",
  redactionPolicyVersion: "skills.telemetry.v0",
  createdAtMs: Date.now(),
  body: {
    schema_version: "0.1",
    event_id: "evt:1",
    event_type: "skill.run_started",
    occurred_at: "2026-07-28T00:00:00Z",
    sequence: 1,
    idempotency_key: "idem:skills-1",
    actor_id: "actor:test",
    run_id: "run:1",
    skill_id: "skill.fixture.echo",
    skill_release_hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    execution_profile_hash:
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    outcome: "info",
    sensitivity: "public_internal",
  },
};

const assertionKeyRef = {
  source: "env" as const,
  provider: "default",
  id: "LINKTREND_SKILLS_ASSERTION_PEM",
};

const writeArgs = {
  toolName: "skills_run_start",
  idempotencyKey: "idem:skills-1",
  arguments: { run_id: "run:1" },
  envelope: sampleEnvelope,
};

describe("linkskills transport modes", () => {
  it("calls allowlisted discovery through the host machine-token facade only", async () => {
    const acquire = vi.fn(async ({ bindingId }) => ({
      bindingId,
      bindingFingerprint: `fp-${bindingId}`,
      accessToken: "not-exposed-to-model",
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const config = parseLinkskillsConfig({
      transportMode: "mcp",
      machineToken: {
        bindingId: "linkskills-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "skills-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const callTool = vi.fn(async () => ({ structuredContent: { skills: [] } }));
    const result = await callLinkskillsMcpTool({
      api: {
        ...stubApi({
          mcp: {
            servers: {
              linkskills: {
                enabled: true,
                url: "https://skills.example.test/mcp",
                auth: "machine_token",
              },
            },
          },
        }),
        machineTokenFacade: {
          pluginId: "linkskills",
          grantedBindingIds: new Set(["linkskills-stage"]),
          acquire,
          invalidate: vi.fn(),
          health: () => ({
            pluginId: "linkskills",
            bindingId: "linkskills-stage",
            granted: true,
            registered: true,
            cached: false,
          }),
          unregister: vi.fn(),
        },
      },
      config,
      toolName: "skills_search",
      arguments: { query: "approved test" },
      createMcpSession: async () => ({ callTool, close: async () => undefined }),
    });
    expect(result).toEqual({ ok: true, result: { skills: [] } });
    expect(acquire).toHaveBeenCalledWith(
      expect.objectContaining({ bindingId: "linkskills-stage" }),
    );
    expect(callTool).toHaveBeenCalledWith("skills_search", { query: "approved test" });
  });

  it("defaults transportMode to disabled and returns transport_disabled", async () => {
    const config = parseLinkskillsConfig({});
    expect(config.transportMode).toBe("disabled");
    expect(config.mcpServerName).toBe("linkskills");
    const transport = resolveLinkskillsTransport({
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
    const config = parseLinkskillsConfig({
      transportMode: "fake",
      environment: "stage",
    });
    const transport = resolveLinkskillsTransport({
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
    const config = parseLinkskillsConfig({
      transportMode: "fake",
      environment: "test",
    });
    const transport = resolveLinkskillsTransport({
      api: stubApi(),
      config,
      fakeForTests: {
        authorization: "Bearer fake",
        fake: {
          dispatch: () => ({ ok: true, data: { replayed: false } }),
        },
      },
    });
    const result = await transport.write(writeArgs);
    expect(result.ok).toBe(true);
  });

  it("http mode POSTs Gateway /v1/{operation} envelope with SecretRef bearer", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://skills.example.test/v1/skills_run_start");
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer fake-skills-token");
      expect(headers.get("idempotency-key")).toBe("idem:skills-1");
      expect(headers.get("x-request-id")).toBe("idem:skills-1");
      const rawBody = init?.body;
      const bodyText =
        typeof rawBody === "string"
          ? rawBody
          : rawBody instanceof Uint8Array
            ? Buffer.from(rawBody).toString("utf8")
            : rawBody == null
              ? ""
              : JSON.stringify(rawBody);
      const body = JSON.parse(bodyText) as Record<string, unknown>;
      expect(body).toEqual({
        params: { run_id: "run:1" },
        idempotency_key: "idem:skills-1",
        request_id: "idem:skills-1",
      });
      expect(body).not.toHaveProperty("toolName");
      expect(body).not.toHaveProperty("idempotencyKey");
      expect(body).not.toHaveProperty("arguments");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const config = parseLinkskillsConfig({
      transportMode: "http",
      skillsEndpoint: "https://skills.example.test",
      skillsCredential: {
        source: "env",
        provider: "default",
        id: "LINKTREND_SKILLS_FAKE_TOKEN",
      },
    });
    const transport = resolveLinkskillsTransport({
      api: stubApi(),
      config,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      env: { LINKTREND_SKILLS_FAKE_TOKEN: "fake-skills-token" },
    });
    const result = await transport.write(writeArgs);
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("buildLinkskillsHttpOperationUrl treats skillsEndpoint as Gateway base", () => {
    expect(
      buildLinkskillsHttpOperationUrl("https://skills.example.test", "skills_run_start").href,
    ).toBe("https://skills.example.test/v1/skills_run_start");
    expect(
      buildLinkskillsHttpOperationUrl("https://skills.example.test/", "skills_feedback_submit")
        .href,
    ).toBe("https://skills.example.test/v1/skills_feedback_submit");
    expect(
      buildLinkskillsHttpOperationUrl(
        "https://linktrend-mini.tailf7e13a.ts.net:9445",
        "skills_run_complete",
      ).href,
    ).toBe("https://linktrend-mini.tailf7e13a.ts.net:9445/v1/skills_run_complete");
    // Accidental full operation URL paste strips /v1/... and rebuilds for the drain op.
    expect(
      buildLinkskillsHttpOperationUrl(
        "https://skills.example.test/v1/skills_list",
        "skills_run_start",
      ).href,
    ).toBe("https://skills.example.test/v1/skills_run_start");
    expect(
      buildLinkskillsHttpOperationUrl("https://skills.example.test/gateway/", "skills_run_fail")
        .href,
    ).toBe("https://skills.example.test/gateway/v1/skills_run_fail");
    expect(buildLinkskillsHttpOperationUrl("https://skills.example.test", "skills_list").href).toBe(
      "https://skills.example.test/v1/skills_list",
    );
  });

  it("buildLinkskillsHttpOperationUrl rejects traversal and origin/host change", () => {
    expect(() =>
      buildLinkskillsHttpOperationUrl(
        "https://skills.example.test",
        "skills_run_start/../../admin",
      ),
    ).toThrow(/allowlist|drain|invalid/i);
    expect(() =>
      buildLinkskillsHttpOperationUrl("https://skills.example.test", "../skills_run_start"),
    ).toThrow(/allowlist|drain|invalid/i);
    expect(() =>
      buildLinkskillsHttpOperationUrl("https://skills.example.test", "skills_unreviewed_admin"),
    ).toThrow(/allowlist/i);
    expect(() =>
      buildLinkskillsHttpOperationUrl(
        "https://skills.example.test/foo/../../evil",
        "skills_run_start",
      ),
    ).toThrow(/path|prefix|rejected/i);
    expect(() =>
      buildLinkskillsHttpOperationUrl("https://user:pass@skills.example.test", "skills_run_start"),
    ).toThrow(/userinfo/i);
  });

  it("mcp mode calls exact skills_* ops through injected session", async () => {
    const calls: string[] = [];
    const config = parseLinkskillsConfig({ transportMode: "mcp" });
    const transport = resolveLinkskillsTransport({
      api: stubApi({
        mcp: {
          servers: {
            linkskills: {
              enabled: true,
              url: "https://mcp.example.test/skills",
              headers: { Authorization: "Bearer mcp-fake" },
            },
          },
        },
      }),
      config,
      createMcpSession: async () => ({
        async callTool(name) {
          calls.push(name);
          return { structuredContent: { ok: true } };
        },
        async close() {},
      }),
    });
    const result = await transport.write(writeArgs);
    expect(result.ok).toBe(true);
    expect(calls).toEqual(["skills_run_start"]);
  });

  it("maps event types to frozen skills_* drain ops", () => {
    expect(mapSkillsEventTypeToToolName("skill.run_started")).toBe("skills_run_start");
    expect(mapSkillsEventTypeToToolName("skill.run_failed")).toBe("skills_run_fail");
    expect(mapSkillsEventTypeToToolName("skill.trace_candidate")).toBe(
      "skills_trace_candidate_submit",
    );
    expect(resolveSkillsDrainToolName({ eventType: "skill.run_completed" })).toBe(
      "skills_run_complete",
    );
    expect(resolveSkillsDrainToolName({})).toBe("skills_feedback_submit");
  });

  it("still rejects prohibited conversation fields", () => {
    expect(
      findProhibitedSkillsField({
        event_type: "skill.run_started",
        conversation: { text: "nope" },
      }),
    ).toMatchObject({ key: "conversation" });
  });

  it("mcp oauth-only without SecretRef header returns auth_profile_required", async () => {
    const config = parseLinkskillsConfig({ transportMode: "mcp" });
    const transport = resolveLinkskillsTransport({
      api: stubApi({
        mcp: {
          servers: {
            linkskills: {
              enabled: true,
              url: "https://mcp.example.test/skills",
              oauth: { authProfileId: "linkskills-stage-mcp" },
            },
          },
        },
      }),
      config,
    });
    const result = await transport.write(writeArgs);
    expect(result).toMatchObject({
      ok: false,
      errorCode: "auth_profile_required",
    });
  });

  it("http mode posts with machineToken bearer via injected resolver", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer mt-skills-access");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const resolveMachineTokenAccess = vi.fn(async ({ bindingId }) => {
      expect(bindingId).toBe("linkskills-stage");
      return {
        bindingId,
        bindingFingerprint: `fp-${bindingId}`,
        accessToken: "mt-skills-access",
        expiresAt: Date.now() + 60_000,
        tokenType: "Bearer" as const,
      };
    });
    const config = parseLinkskillsConfig({
      transportMode: "http",
      skillsEndpoint: "https://skills.example.test",
      machineToken: {
        bindingId: "linkskills-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "skills-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const transport = resolveLinkskillsTransport({
      api: stubApi(),
      config,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      env: { LINKTREND_SKILLS_ASSERTION_PEM: "PEM-SKILLS" },
      resolveMachineTokenAccess,
    });
    const result = await transport.write(writeArgs);
    expect(result.ok).toBe(true);
    expect(resolveMachineTokenAccess).toHaveBeenCalledOnce();
  });

  it("rejects non-HTTPS skillsEndpoint outside local-test loopback", () => {
    expect(() =>
      parseLinkskillsConfig({
        transportMode: "http",
        environment: "production",
        skillsEndpoint: "http://skills.example.test/telemetry",
      }),
    ).toThrow(/HTTPS/);
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
      const config = parseLinkskillsConfig({
        transportMode: "http",
        skillsEndpoint: "https://skills.example.test",
        machineToken: {
          bindingId: "linkskills-stage",
          issuerUrl: "https://issuer.example.test",
          clientId: "skills-client",
          clientAssertionKeyRef: assertionKeyRef,
        },
      });
      const transport = resolveLinkskillsTransport({
        api: stubApi(),
        config,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        env: { LINKTREND_SKILLS_ASSERTION_PEM: "PEM-SKILLS" },
        resolveMachineTokenAccess,
        invalidateMachineTokenCache,
      });
      const result = await transport.write(writeArgs);
      expect(result.ok).toBe(true);
      expect(invalidateMachineTokenCache).toHaveBeenCalledWith("fp-linkskills-stage");
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    }
  });

  it("mcp machine_token injects bearer and does not return auth_profile_required", async () => {
    const seenHeaders: Array<Record<string, unknown> | undefined> = [];
    const resolveMachineTokenAccess = vi.fn(async ({ bindingId }) => ({
      bindingId,
      bindingFingerprint: `fp-${bindingId}`,
      accessToken: "mt-mcp-skills",
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const config = parseLinkskillsConfig({
      transportMode: "mcp",
      machineToken: {
        bindingId: "linkskills-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "skills-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const transport = resolveLinkskillsTransport({
      api: stubApi({
        mcp: {
          servers: {
            linkskills: {
              enabled: true,
              url: "https://mcp.example.test/skills",
              auth: "machine_token",
              // Agreeing server+plugin bindings (same bindingId + key material).
              machineToken: {
                bindingId: "linkskills-stage",
                issuerUrl: "https://issuer.example.test",
                clientId: "skills-client",
                clientAssertionKeyRef: assertionKeyRef,
              },
            },
          },
        },
      }),
      config,
      env: {
        LINKTREND_SKILLS_ASSERTION_PEM: "PEM-SKILLS",
      },
      resolveMachineTokenAccess,
      createMcpSession: async (server) => {
        seenHeaders.push(server.headers);
        return {
          async callTool() {
            return { structuredContent: { ok: true } };
          },
          async close() {},
        };
      },
    });
    const result = await transport.write(writeArgs);
    expect(result.ok).toBe(true);
    expect(result.errorCode).not.toBe("auth_profile_required");
    expect(seenHeaders[0]).toMatchObject({ Authorization: "Bearer mt-mcp-skills" });
  });

  it("mcp oauth is not overridden by a present machineToken block", async () => {
    const resolveMachineTokenAccess = vi.fn(async ({ bindingId }) => ({
      bindingId,
      bindingFingerprint: `fp-${bindingId}`,
      accessToken: "mt-must-not-apply",
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const config = parseLinkskillsConfig({
      transportMode: "mcp",
      machineToken: {
        bindingId: "linkskills-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "skills-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const transport = resolveLinkskillsTransport({
      api: stubApi({
        mcp: {
          servers: {
            linkskills: {
              enabled: true,
              url: "https://mcp.example.test/skills",
              auth: "oauth",
              oauth: { authProfileId: "skills-oauth" },
              machineToken: {
                bindingId: "linkskills-stage",
                issuerUrl: "https://issuer.example.test",
                clientId: "skills-client",
                clientAssertionKeyRef: assertionKeyRef,
              },
            },
          },
        },
      }),
      config,
      env: { LINKTREND_SKILLS_ASSERTION_PEM: "PEM-SKILLS" },
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
    const config = parseLinkskillsConfig({
      transportMode: "mcp",
    });
    const transport = resolveLinkskillsTransport({
      api: stubApi({
        mcp: {
          servers: {
            linkskills: {
              enabled: true,
              url: "https://mcp.example.test/skills",
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
      createMcpSession: async () => {
        throw new Error("should not open MCP session for incomplete machine_token");
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
    const config = parseLinkskillsConfig({
      transportMode: "mcp",
      machineToken: {
        bindingId: "linkskills-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "skills-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const transport = resolveLinkskillsTransport({
      api: stubApi({
        mcp: {
          servers: {
            linkskills: {
              enabled: true,
              url: "https://mcp.example.test/skills",
              auth: "machine_token",
              machineToken: params.serverMachineToken,
            },
          },
        },
      }),
      config,
      env: { LINKTREND_SKILLS_ASSERTION_PEM: "PEM-SKILLS" },
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
        bindingId: "linkskills-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "skills-client",
        clientAssertionKeyRef: {
          source: "env",
          provider: "default",
        },
      },
      expectSafeMessage: /SecretRef/,
    });
  });

  it("mcp present-invalid bad issuer fail-closes and does not use plugin binding", async () => {
    await writeWithInvalidServerMachineToken({
      serverMachineToken: {
        bindingId: "linkskills-stage",
        issuerUrl: "https://issuer.example.test/tenant",
        clientId: "skills-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
      expectSafeMessage: /issuerUrl|path/i,
    });
  });

  it("mcp present-invalid bad clientId fail-closes and does not use plugin binding", async () => {
    await writeWithInvalidServerMachineToken({
      serverMachineToken: {
        bindingId: "linkskills-stage",
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
        bindingId: "linkskills-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "skills-client",
        clientAssertionKeyRef: assertionKeyRef,
        audience: "",
      },
      expectSafeMessage: /audience/,
    });
    await writeWithInvalidServerMachineToken({
      serverMachineToken: {
        bindingId: "linkskills-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "skills-client",
        clientAssertionKeyRef: assertionKeyRef,
        scope: 42,
      },
      expectSafeMessage: /scope/,
    });
  });

  it("mcp present-invalid partial binding fail-closes and does not use plugin binding", async () => {
    await writeWithInvalidServerMachineToken({
      serverMachineToken: {
        bindingId: "linkskills-stage",
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
    const config = parseLinkskillsConfig({
      transportMode: "mcp",
      machineToken: {
        bindingId: "linkskills-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "skills-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const transport = resolveLinkskillsTransport({
      api: stubApi({
        mcp: {
          servers: {
            linkskills: {
              enabled: true,
              url: "https://mcp.example.test/skills",
              auth: "machine_token",
              machineToken: {
                bindingId: "linkskills-stage",
                issuerUrl: "https://issuer.example.test",
                clientId: "skills-client",
                clientAssertionKeyRef: {
                  source: "env",
                  provider: "default",
                  id: "LINKTREND_SKILLS_SERVER_PEM",
                },
              },
            },
          },
        },
      }),
      config,
      env: {
        LINKTREND_SKILLS_ASSERTION_PEM: "PEM-SKILLS",
        LINKTREND_SKILLS_SERVER_PEM: "server-pem",
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

  it("rejects literal PEM clientAssertionKeyRef in schema parse", () => {
    expect(() =>
      parseLinkskillsConfig({
        machineToken: {
          bindingId: "linkskills-stage",
          issuerUrl: "https://issuer.example.test",
          clientId: "skills-client",
          clientAssertionKeyRef: "literal-pem",
        },
      }),
    ).toThrow(/SecretRef object/);
  });

  it("parses allowPrivateNetwork opt-in for trusted-private HTTPS issuers", () => {
    const config = parseLinkskillsConfig({
      environment: "stage",
      machineToken: {
        bindingId: "linkskills-stage",
        issuerUrl: "https://linktrend-mini.tailf7e13a.ts.net:9443",
        clientId: "skills-client",
        allowPrivateNetwork: true,
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    expect(config.machineToken?.allowPrivateNetwork).toBe(true);
  });

  it("mcp conflicting allowPrivateNetwork flags fail-closes", async () => {
    const resolveMachineTokenAccess = vi.fn(async ({ bindingId }) => ({
      bindingId,
      bindingFingerprint: `fp-${bindingId}`,
      accessToken: "mt-must-not-apply",
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const config = parseLinkskillsConfig({
      transportMode: "mcp",
      machineToken: {
        bindingId: "linkskills-stage",
        issuerUrl: "https://linktrend-mini.tailf7e13a.ts.net:9443",
        clientId: "skills-client",
        allowPrivateNetwork: true,
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const transport = resolveLinkskillsTransport({
      api: stubApi({
        mcp: {
          servers: {
            linkskills: {
              enabled: true,
              url: "https://mcp.example.test/skills",
              auth: "machine_token",
              machineToken: {
                bindingId: "linkskills-stage",
                issuerUrl: "https://linktrend-mini.tailf7e13a.ts.net:9443",
                clientId: "skills-client",
                clientAssertionKeyRef: assertionKeyRef,
              },
            },
          },
        },
      }),
      config,
      env: {
        LINKTREND_SKILLS_ASSERTION_PEM: "PEM-SKILLS",
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

  it("skills and brain machineToken fixtures use distinct bindingIds", () => {
    const skills = parseLinkskillsConfig({
      machineToken: {
        bindingId: "linkskills-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "skills-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const brainBindingId = "linkbrain-stage";
    expect(skills.machineToken?.bindingId).toBe("linkskills-stage");
    expect(skills.machineToken?.bindingId).not.toBe(brainBindingId);
  });

  it("uses api.machineTokenFacade without local resolveMachineTokenAccess", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const acquire = vi.fn(async ({ bindingId }) => ({
      bindingId,
      bindingFingerprint: `fp-${bindingId}`,
      accessToken: "host-injected-skills-token",
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const facade = {
      pluginId: "linkskills",
      grantedBindingIds: new Set(["linkskills-stage"]),
      acquire,
      invalidate: vi.fn(),
      health: () => ({
        pluginId: "linkskills",
        bindingId: "linkskills-stage",
        granted: true,
        registered: true,
        cached: false,
      }),
      unregister: vi.fn(),
    };
    const config = parseLinkskillsConfig({
      transportMode: "http",
      skillsEndpoint: "https://skills.example.test",
      machineToken: {
        bindingId: "linkskills-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "skills-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const transport = resolveLinkskillsTransport({
      api: { ...stubApi(), machineTokenFacade: facade },
      config,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      env: { LINKTREND_SKILLS_ASSERTION_PEM: "PEM-SKILLS" },
    });
    const result = await transport.write(writeArgs);
    expect(result.ok).toBe(true);
    expect(acquire).toHaveBeenCalledOnce();
    const fetchCalls = fetchImpl.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>;
    expect(new Headers(fetchCalls[0]?.[1]?.headers).get("authorization")).toBe(
      "Bearer host-injected-skills-token",
    );
  });

  it("fail-closes when machineToken is configured without an injected facade", async () => {
    const config = parseLinkskillsConfig({
      transportMode: "http",
      skillsEndpoint: "https://skills.example.test",
      machineToken: {
        bindingId: "linkskills-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "skills-client",
        clientAssertionKeyRef: assertionKeyRef,
      },
    });
    const transport = resolveLinkskillsTransport({
      api: stubApi(),
      config,
      env: { LINKTREND_SKILLS_ASSERTION_PEM: "PEM-SKILLS" },
    });
    const result = await transport.write(writeArgs);
    expect(result).toMatchObject({
      ok: false,
      errorCode: "machine_token_error",
      safeMessage: expect.stringMatching(/facade is not configured/i),
    });
  });
});

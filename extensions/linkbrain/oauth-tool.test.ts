import { describe, expect, it, vi } from "vitest";
import { createLinkbrainReadTool, createLinkbrainWriteTool } from "./src/oauth-tool.js";

const machineToken = {
  bindingId: "linkbrain-test",
  issuerUrl: "https://issuer.example.test",
  clientId: "brain-client",
  clientAssertionKeyRef: {
    source: "env" as const,
    provider: "default",
    id: "TEST_ASSERTION_KEY",
  },
};

function toolApi(pluginConfig: Record<string, unknown>) {
  return {
    pluginConfig: { transportMode: "mcp", machineToken, ...pluginConfig },
    config: {},
    machineTokenFacade: {
      pluginId: "linkbrain",
      grantedBindingIds: new Set(["linkbrain-test"]),
      acquire: vi.fn(),
      invalidate: vi.fn(),
      health: vi.fn(),
      unregister: vi.fn(),
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  } as never;
}

function toolContext(options?: {
  alsoAllow?: string[];
  allow?: string[];
  includeBinding?: boolean;
  taskId?: string;
}) {
  return {
    agentId: "lisa",
    sessionKey: "agent:lisa:proof",
    toolBindings:
      options?.includeBinding === false
        ? undefined
        : { linkbrain: { taskId: options?.taskId ?? "task-trusted-1" } },
    config: {
      agents: {
        list: [
          {
            id: "lisa",
            tools: {
              ...(options?.allow ? { allow: options.allow } : {}),
              ...(options?.alsoAllow ? { alsoAllow: options.alsoAllow } : {}),
            },
          },
        ],
      },
    },
  } as never;
}

function writeTool(
  pluginConfig: Record<string, unknown>,
  invokeWrite: ReturnType<typeof vi.fn>,
  context = toolContext({ alsoAllow: ["linkbrain_write"] }),
) {
  const tool = createLinkbrainWriteTool(toolApi(pluginConfig), context, {
    invokeWrite: invokeWrite as never,
  });
  expect(tool).not.toBeNull();
  return tool!;
}

function captureParams(overrides: Record<string, unknown> = {}) {
  return {
    operation: "brain_capture_batch",
    arguments: {
      batch: {
        batchId: "batch-proof-1",
        sessionId: "session-proof-1",
        idempotencyKey: "capture-proof-1",
        capturedAt: "2026-08-10T12:00:01.000Z",
        events: [
          {
            eventId: "event-proof-1",
            sequence: 1,
            occurredAt: "2026-08-10T12:00:00.000Z",
            role: "actor",
            eventType: "status",
            content: "harmless proof",
            classification: "private",
          },
        ],
        ...overrides,
      },
    },
  };
}

describe("linkbrain native OAuth bridge", () => {
  it("reports only the fixed transport-policy code for an insecure managed MCP endpoint", async () => {
    const api = toolApi({
      captureEnqueue: true,
      captureDrain: true,
      environment: "production",
    }) as unknown as {
      config: Record<string, unknown>;
    };
    api.config = {
      mcp: {
        servers: {
          linkbrain: {
            enabled: true,
            url: "http://127.0.0.1:18789/mcp",
            auth: "machine_token",
          },
        },
      },
      agents: {
        list: [{ id: "lisa", tools: { alsoAllow: ["linkbrain_write"] } }],
      },
    };
    const tool = createLinkbrainWriteTool(
      api as never,
      toolContext({ alsoAllow: ["linkbrain_write"] }),
    );
    expect(tool).not.toBeNull();
    const result = await tool!.execute("policy", captureParams());
    expect(result.details).toEqual({ ok: false, reason: "endpoint_insecure" });
    expect(result.content).toEqual([{ type: "text", text: "LiNKbrain write failed safely." }]);
  });

  it("rejects model-supplied actor identity before opening a transport", async () => {
    const tool = createLinkbrainReadTool({
      pluginConfig: { mcpRead: true, transportMode: "mcp" },
      config: {},
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    } as never);
    const result = await tool.execute("test", {
      operation: "brain_search",
      arguments: { query: "test", actorId: "spoofed" },
    });
    expect(result.content[0]?.text).toBe("Actor identity is assigned by LiNKbrain.");
  });

  it("keeps capture and coordination gates independent and fail-closed", async () => {
    const invokeWrite = vi.fn(async () => ({ ok: true as const }));
    const capture = writeTool(
      { captureEnqueue: true, captureDrain: false, coordinationWrites: true },
      invokeWrite,
    );
    expect((await capture.execute("capture", captureParams())).details).toEqual({
      ok: false,
      reason: "disabled",
    });

    const checkpoint = writeTool(
      { captureEnqueue: true, captureDrain: true, coordinationWrites: false },
      invokeWrite,
    );
    expect(
      (
        await checkpoint.execute("checkpoint", {
          operation: "brain_checkpoint_write",
          arguments: {
            idempotencyKey: "checkpoint-proof-1",
            summary: "bounded proof",
          },
        })
      ).details,
    ).toEqual({ ok: false, reason: "disabled" });
    expect(invokeWrite).not.toHaveBeenCalled();
  });

  it("requires an exact agent-scoped alsoAllow grant", () => {
    const api = toolApi({ captureEnqueue: true, captureDrain: true });
    const deniedContexts = [
      toolContext(),
      toolContext({ allow: ["*"] }),
      toolContext({ allow: ["group:plugins"] }),
      toolContext({ allow: ["linkbrain"] }),
      toolContext({ allow: ["linkbrain_write"] }),
      toolContext({ alsoAllow: ["*"] }),
    ];
    for (const context of deniedContexts) {
      expect(createLinkbrainWriteTool(api, context)).toBeNull();
    }
    expect(
      createLinkbrainWriteTool(api, toolContext({ alsoAllow: ["linkbrain_write"] })),
    ).not.toBeNull();
  });

  it("allows only capture and owned-task checkpoint operations", async () => {
    const invokeWrite = vi.fn(async () => ({ ok: true as const }));
    const tool = writeTool(
      { captureEnqueue: true, captureDrain: true, coordinationWrites: true },
      invokeWrite,
    );
    for (const operation of ["brain_task_update", "brain_message_send", "brain_delete_all"]) {
      const result = await tool.execute("denied", { operation, arguments: {} });
      expect(result.details).toEqual({ ok: false, reason: "invalid_request" });
    }
    expect(invokeWrite).not.toHaveBeenCalled();
  });

  it("rejects unknown fields, wrong shapes, and nested actor spoof fields", async () => {
    const invokeWrite = vi.fn(async () => ({ ok: true as const }));
    const tool = writeTool({ captureEnqueue: true, captureDrain: true }, invokeWrite);
    const wrongShape = await tool.execute("wrong", {
      operation: "brain_capture_batch",
      arguments: { batch: "not-an-object" },
    });
    expect(wrongShape.details).toEqual({ ok: false, reason: "invalid_request" });

    const unknown = await tool.execute("unknown", captureParams({ extra: "no" }));
    expect(unknown.details).toEqual({ ok: false, reason: "invalid_request" });

    const spoof = captureParams();
    (spoof.arguments.batch.events[0] as Record<string, unknown>).actorBindingId = "spoofed";
    const rejected = await tool.execute("spoof", spoof);
    expect(rejected.details).toEqual({ ok: false, reason: "invalid_request" });
    expect(invokeWrite).not.toHaveBeenCalled();
  });

  it("validates ordered events and bounds capture size", async () => {
    const invokeWrite = vi.fn(async () => ({ ok: true as const }));
    const tool = writeTool(
      { captureEnqueue: true, captureDrain: true, batchMaxEvents: 2 },
      invokeWrite,
    );
    const duplicate = captureParams();
    duplicate.arguments.batch.events.push({
      ...duplicate.arguments.batch.events[0]!,
      eventId: "event-proof-2",
    });
    expect((await tool.execute("duplicate", duplicate)).details).toEqual({
      ok: false,
      reason: "invalid_request",
    });

    const oversized = captureParams();
    oversized.arguments.batch.events[0]!.content = "x".repeat(4_001);
    expect((await tool.execute("oversized", oversized)).details).toEqual({
      ok: false,
      reason: "invalid_request",
    });

    const invalidTime = captureParams({ capturedAt: "not-an-iso-time" });
    expect((await tool.execute("invalid-time", invalidTime)).details).toEqual({
      ok: false,
      reason: "invalid_request",
    });

    const staleCapture = captureParams({ capturedAt: "2026-08-10T11:59:59.000Z" });
    expect((await tool.execute("stale-capture", staleCapture)).details).toEqual({
      ok: false,
      reason: "invalid_request",
    });
    expect(invokeWrite).not.toHaveBeenCalled();
  });

  it("forwards capture idempotency once, redacts text, and suppresses Brain results", async () => {
    const invokeWrite = vi.fn(async () => ({
      ok: true as const,
      result: { privateReceipt: "must-not-be-visible" },
    }));
    const tool = writeTool({ captureEnqueue: true, captureDrain: true }, invokeWrite);
    const params = captureParams();
    params.arguments.batch.events[0]!.content = `${["api", "key"].join("_")}=fixture-value`;
    const result = await tool.execute("capture", params);
    expect(invokeWrite).toHaveBeenCalledOnce();
    expect(invokeWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "brain_capture_batch",
        idempotencyKey: "capture-proof-1",
        arguments: expect.objectContaining({
          batch: expect.objectContaining({ idempotencyKey: "capture-proof-1" }),
        }),
      }),
    );
    const calls = invokeWrite.mock.calls as unknown as Array<[unknown]>;
    const forwarded = calls[0]?.[0] as {
      arguments: { batch: { events: Array<{ content?: string }> } };
    };
    expect(forwarded.arguments.batch.events[0]?.content).toBe("[REDACTED]");
    expect(result.content[0]?.text).toBe("LiNKbrain write accepted.");
    expect(result.details).toEqual({ ok: true, operation: "brain_capture_batch" });
    expect(JSON.stringify(result)).not.toContain("privateReceipt");
  });

  it("forwards only the strict checkpoint contract with its idempotency key", async () => {
    const invokeWrite = vi.fn(async () => ({ ok: true as const }));
    const tool = writeTool({ coordinationWrites: true }, invokeWrite);
    const result = await tool.execute("checkpoint", {
      operation: "brain_checkpoint_write",
      arguments: {
        idempotencyKey: "checkpoint-proof-1",
        summary: "harmless checkpoint",
        decisions: ["keep scope bounded"],
        nextActions: ["request review"],
      },
    });
    expect(result.details).toEqual({ ok: true, operation: "brain_checkpoint_write" });
    expect(invokeWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "brain_checkpoint_write",
        idempotencyKey: "checkpoint-proof-1",
        arguments: {
          taskId: "task-trusted-1",
          idempotencyKey: "checkpoint-proof-1",
          summary: "harmless checkpoint",
          decisions: ["keep scope bounded"],
          nextActions: ["request review"],
        },
      }),
    );
  });

  it("rejects checkpoints without a trusted task binding", async () => {
    const invokeWrite = vi.fn(async () => ({ ok: true as const }));
    const tool = writeTool(
      { coordinationWrites: true },
      invokeWrite,
      toolContext({ alsoAllow: ["linkbrain_write"], includeBinding: false }),
    );
    const result = await tool.execute("checkpoint", {
      operation: "brain_checkpoint_write",
      arguments: {
        idempotencyKey: "checkpoint-proof-1",
        summary: "harmless checkpoint",
      },
    });
    expect(result.details).toEqual({ ok: false, reason: "task_binding_unavailable" });
    expect(invokeWrite).not.toHaveBeenCalled();
  });

  it("rejects a model-supplied checkpoint taskId instead of overriding the trusted binding", async () => {
    const invokeWrite = vi.fn(async () => ({ ok: true as const }));
    const tool = writeTool({ coordinationWrites: true }, invokeWrite);
    const result = await tool.execute("checkpoint", {
      operation: "brain_checkpoint_write",
      arguments: {
        taskId: "task-cross-scope",
        idempotencyKey: "checkpoint-proof-1",
        summary: "harmless checkpoint",
      },
    });
    expect(result.details).toEqual({ ok: false, reason: "invalid_request" });
    expect(invokeWrite).not.toHaveBeenCalled();
  });

  it("requires a host machine-token facade before invoking transport", async () => {
    const invokeWrite = vi.fn(async () => ({ ok: true as const }));
    const api = toolApi({ captureEnqueue: true, captureDrain: true }) as {
      machineTokenFacade?: unknown;
    };
    delete api.machineTokenFacade;
    const tool = createLinkbrainWriteTool(
      api as never,
      toolContext({ alsoAllow: ["linkbrain_write"] }),
      { invokeWrite },
    );
    expect(tool).not.toBeNull();
    const result = await tool!.execute("missing-auth", captureParams());
    expect(result.content[0]?.text).toBe("LiNKbrain write authentication is unavailable.");
    expect(result.details).toEqual({ ok: false, reason: "machine_token_unavailable" });

    const missingBindingTool = createLinkbrainWriteTool(
      toolApi({ captureEnqueue: true, captureDrain: true, machineToken: undefined }),
      toolContext({ alsoAllow: ["linkbrain_write"] }),
      { invokeWrite },
    );
    expect(missingBindingTool).not.toBeNull();
    const missingBinding = await missingBindingTool!.execute("missing-binding", captureParams());
    expect(missingBinding.details).toEqual({
      ok: false,
      reason: "machine_token_unavailable",
    });
    expect(invokeWrite).not.toHaveBeenCalled();
  });

  it("redacts thrown transport errors and never includes credential material", async () => {
    const tool = createLinkbrainWriteTool(
      toolApi({ captureEnqueue: true, captureDrain: true }),
      toolContext({ alsoAllow: ["linkbrain_write"] }),
      {
        invokeWrite: async () => {
          throw new Error("sensitive transport detail");
        },
      },
    );
    expect(tool).not.toBeNull();
    const result = await tool!.execute("failure", captureParams());
    expect(result.content[0]?.text).toBe("LiNKbrain write failed safely.");
    expect(result.details).toEqual({ ok: false, reason: "write_failed" });
    expect(JSON.stringify(result)).not.toContain("sensitive transport detail");
  });
});

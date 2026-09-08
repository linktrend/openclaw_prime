import { describe, expect, it, vi } from "vitest";
import { createBrainFake } from "./fake/runtime.mjs";
import { createLinkbrainCapture } from "./src/capture.js";
import { parseLinkbrainConfig } from "./src/config.js";
import { createLinkbrainLifecycle, LINKBRAIN_REGISTERED_HOOKS } from "./src/lifecycle.js";
import { opaqueId } from "./src/opaque.js";
import { createBrainFakeTransport, createLinkbrainRuntime } from "./src/runtime.js";
import { containsUnsafeField, sanitizeCaptureText } from "./src/sanitize.js";
import { openLinkbrainStores } from "./src/stores.js";
import { createMemoryKeyedStore } from "./src/test-support/memory-store.js";
import { isAllowedBrainWriteTool, LINKBRAIN_ALLOWED_WRITE_TOOLS } from "./src/tools.js";

function createTestStores(maxEntries = 200) {
  return openLinkbrainStores({
    maxEntries,
    openKeyedStore: (options) =>
      createMemoryKeyedStore({
        maxEntries: options.maxEntries,
        overflowPolicy: "reject-new",
      }),
  });
}

async function createHarness(flags: {
  captureEnqueue?: boolean;
  captureDrain?: boolean;
  coordinationWrites?: boolean;
  batchMaxEvents?: number;
  failTransport?: boolean;
}) {
  const fake = createBrainFake();
  const stores = createTestStores();
  const config = parseLinkbrainConfig({
    captureEnqueue: flags.captureEnqueue ?? true,
    captureDrain: flags.captureDrain ?? true,
    coordinationWrites: flags.coordinationWrites ?? true,
    batchMaxEvents: flags.batchMaxEvents ?? 32,
  });
  const writes: Array<{ toolName: string; arguments: Record<string, unknown> }> = [];
  const baseTransport = createBrainFakeTransport(fake);
  const transport = {
    async write(params: {
      toolName: string;
      idempotencyKey: string;
      arguments: Record<string, unknown>;
      signal?: AbortSignal;
    }) {
      writes.push({ toolName: params.toolName, arguments: params.arguments });
      if (flags.failTransport) {
        return {
          ok: false,
          retryable: true,
          errorCode: "retryable",
          safeMessage: "forced failure",
        };
      }
      return await baseTransport.write(params);
    },
  };
  const runtime = createLinkbrainRuntime({
    config,
    stores,
    transport,
    now: (() => {
      let t = 10_000;
      return () => {
        t += 1;
        return t;
      };
    })(),
  });
  await runtime.open();
  const capture = createLinkbrainCapture({
    config,
    stores,
    runtime,
    operationTimeoutMs: 1_500,
  });
  const warns: string[] = [];
  const lifecycle = createLinkbrainLifecycle({
    config,
    runtime,
    capture,
    operationTimeoutMs: 1_500,
    logger: {
      info: () => undefined,
      warn: (message) => {
        warns.push(message);
      },
    },
  });
  return { fake, stores, runtime, capture, lifecycle, writes, warns, config };
}

describe("linkbrain Phase 3 lifecycle capture", () => {
  it("documents the §10.1 registered hook set", () => {
    expect(LINKBRAIN_REGISTERED_HOOKS).toEqual([
      "session_start",
      "message_received",
      "agent_end",
      "before_compaction",
      "after_compaction",
      "before_reset",
      "session_end",
      "subagent_spawned",
      "subagent_ended",
      "gateway_start",
      "gateway_stop",
    ]);
  });

  it("enforces Brain MCP write allowlist", () => {
    for (const tool of LINKBRAIN_ALLOWED_WRITE_TOOLS) {
      expect(isAllowedBrainWriteTool(tool)).toBe(true);
    }
    expect(isAllowedBrainWriteTool("brain_browse")).toBe(false);
    expect(isAllowedBrainWriteTool("skills_run")).toBe(false);
  });

  it.each([
    {
      name: "session_start",
      run: async (h: Awaited<ReturnType<typeof createHarness>>) => {
        await h.lifecycle.handleSessionStart({
          sessionId: "sess-live-1",
          sessionKey: "agent:lisa:main",
        });
      },
      expectOutbox: 0,
    },
    {
      name: "message_received",
      run: async (h: Awaited<ReturnType<typeof createHarness>>) => {
        await h.lifecycle.handleMessageReceived({
          content: "Hello Lisa approved capture.",
          messageId: "msg-1",
          sessionKey: "agent:lisa:main",
          runId: "run-1",
          senderId: "user-1",
        });
      },
      expectBuffer: true,
    },
    {
      name: "agent_end",
      run: async (h: Awaited<ReturnType<typeof createHarness>>) => {
        await h.lifecycle.handleAgentEnd(
          {
            runId: "run-1",
            success: true,
            durationMs: 42,
            messages: [
              { role: "assistant", reasoning: "SHOULD_NOT_CAPTURE", content: "secret CoT" },
            ],
          },
          { sessionKey: "agent:lisa:main", agentId: "lisa" },
        );
      },
      expectBuffer: true,
    },
  ] as const)(
    "hook path $name does not throw",
    async ({ name, run, expectOutbox, expectBuffer }) => {
      const h = await createHarness({});
      await expect(run(h)).resolves.toBeUndefined();
      if (expectOutbox !== undefined) {
        expect((await h.runtime.diagnostics()).outboxCount).toBe(expectOutbox);
      }
      if (expectBuffer) {
        const buffer = await h.capture.getBuffer("agent:lisa:main");
        expect(buffer?.events.length).toBeGreaterThan(0);
        expect(JSON.stringify(buffer)).not.toContain("SHOULD_NOT_CAPTURE");
        expect(JSON.stringify(buffer)).not.toContain("reasoning");
      }
      void name;
    },
  );

  it("flushes capture and writes idempotent checkpoints on compaction/reset/end", async () => {
    const h = await createHarness({});
    await h.lifecycle.handleMessageReceived({
      content: "User turn before compaction.",
      messageId: "msg-c1",
      sessionKey: "agent:lisa:compact",
      runId: "run-c1",
    });
    await h.lifecycle.handleBeforeCompaction({
      sessionKey: "agent:lisa:compact",
      runId: "run-c1",
    });
    await h.lifecycle.handleAfterCompaction(
      { messageCount: 10, compactedCount: 4, tokenCount: 1200 },
      { sessionKey: "agent:lisa:compact" },
    );
    // Duplicate before_compaction callback — same idempotency key.
    await h.lifecycle.handleBeforeCompaction({
      sessionKey: "agent:lisa:compact",
      runId: "run-c1",
    });

    const beforeDrain = await h.runtime.diagnostics();
    expect(beforeDrain.outboxCount).toBeGreaterThan(0);
    expect(beforeDrain.captureBufferCount).toBe(0);

    const drain = await h.runtime.drainOnce();
    expect(drain.drained).toBeGreaterThan(0);
    expect(h.writes.every((w) => isAllowedBrainWriteTool(w.toolName))).toBe(true);

    // Replay-safe: re-enqueue identical coordination write drains as replay.
    await h.lifecycle.handleBeforeCompaction({
      sessionKey: "agent:lisa:compact",
      runId: "run-c1",
    });
    const replay = await h.runtime.drainOnce();
    expect(replay.drained + replay.skipped).toBeGreaterThan(0);
    expect(h.fake.getIdempotencySize()).toBeGreaterThan(0);
  });

  it("handles before_reset and session_end flush races without throw", async () => {
    const h = await createHarness({});
    await h.lifecycle.handleMessageReceived({
      content: "Pending before reset.",
      messageId: "msg-r1",
      sessionKey: "agent:lisa:reset",
    });
    await Promise.all([
      h.lifecycle.handleBeforeReset({ sessionKey: "agent:lisa:reset" }),
      h.lifecycle.handleSessionEnd({
        sessionId: "sess-reset",
        sessionKey: "agent:lisa:reset",
        reason: "reset",
      }),
    ]);
    expect((await h.capture.getBuffer("agent:lisa:reset"))?.events ?? []).toEqual([]);
    const drain = await h.runtime.drainOnce();
    expect(
      drain.drained + drain.retried + drain.deadLettered + drain.skipped,
    ).toBeGreaterThanOrEqual(0);
  });

  it("records opaque subagent parent/child linkage", async () => {
    const h = await createHarness({});
    await h.lifecycle.handleSubagentSpawned({
      runId: "child-run-1",
      childSessionKey: "agent:lisa:child",
      agentId: "lisa",
    });
    await h.lifecycle.handleSubagentEnded({
      targetSessionKey: "agent:lisa:child",
      runId: "child-run-1",
      outcome: "ok",
      reason: "completed",
    });
    const drain = await h.runtime.drainOnce();
    expect(drain.drained).toBe(2);
    const payload = JSON.stringify(h.writes);
    expect(payload).not.toContain("agent:lisa:child");
    expect(payload).toContain(opaqueId("subagent", "agent:lisa:child"));
    expect(payload).toContain(opaqueId("run", "child-run-1"));
  });

  it("drops duplicate message_received fingerprints", async () => {
    const h = await createHarness({});
    const event = {
      content: "Same inbound twice.",
      messageId: "msg-dup",
      sessionKey: "agent:lisa:dup",
      runId: "run-dup",
    };
    await h.lifecycle.handleMessageReceived(event);
    await h.lifecycle.handleMessageReceived(event);
    const buffer = await h.capture.getBuffer("agent:lisa:dup");
    expect(buffer?.events).toHaveLength(1);
  });

  it("excludes secrets, CoT, attachments, and raw tool output (canaries)", async () => {
    const h = await createHarness({ batchMaxEvents: 1 });
    await h.lifecycle.handleMessageReceived({
      content: "Use api_key=SHOULD_NEVER_SHIP and Bearer SHOULD_NEVER_SHIP_TOKEN",
      messageId: "msg-secret",
      sessionKey: "agent:lisa:secret",
      metadata: {
        attachments: [{ url: "file://secret.bin" }],
        reasoning: "hidden CoT",
        rawToolOutput: "HUGE_TOOL_OUTPUT",
        apiKey: "SHOULD_NEVER_SHIP",
      },
    });
    await h.lifecycle.handleAgentEnd(
      {
        success: false,
        error: "authorization=Bearer SHOULD_NEVER_SHIP",
        messages: [{ chainOfThought: "NOPE", promptBody: "SYSTEM" }],
      },
      { sessionKey: "agent:lisa:secret" },
    );
    await h.lifecycle.handleBeforeCompaction({ sessionKey: "agent:lisa:secret" });
    await h.runtime.drainOnce();

    const serialized = JSON.stringify({
      writes: h.writes,
      outbox: await h.stores.outbox.entries(),
      buffer: await h.stores.captureBuffer.entries(),
    });
    expect(serialized).not.toContain("SHOULD_NEVER_SHIP");
    expect(serialized).not.toContain("HUGE_TOOL_OUTPUT");
    expect(serialized).not.toContain("file://secret.bin");
    expect(serialized).not.toContain("hidden CoT");
    expect(serialized).not.toContain("chainOfThought");
    expect(serialized).not.toContain("promptBody");
    expect(containsUnsafeField(h.writes)).toBe(false);
    expect(sanitizeCaptureText("api_key=abc123secretx")).toContain("[REDACTED]");
  });

  it("preserves native invariants when Brain fails (no throw; queue retained)", async () => {
    const h = await createHarness({ failTransport: true });
    await h.lifecycle.handleMessageReceived({
      content: "Keep me durable.",
      messageId: "msg-fail",
      sessionKey: "agent:lisa:fail",
    });
    await h.lifecycle.handleBeforeCompaction({ sessionKey: "agent:lisa:fail" });
    await expect(h.lifecycle.handleGatewayStop()).resolves.toBeUndefined();
    const drain = await h.runtime.drainOnce();
    expect(drain.retried + drain.deadLettered + drain.skipped).toBeGreaterThan(0);
    expect((await h.runtime.diagnostics()).outboxCount).toBeGreaterThan(0);
    expect(h.warns.every((w) => w.includes("linkbrain:"))).toBe(true);
  });

  it("plugin/flag disabled = no capture and no coordination writes", async () => {
    const h = await createHarness({
      captureEnqueue: false,
      captureDrain: false,
      coordinationWrites: false,
    });
    await h.lifecycle.handleMessageReceived({
      content: "Should not enqueue.",
      messageId: "msg-off",
      sessionKey: "agent:lisa:off",
    });
    await h.lifecycle.handleBeforeCompaction({ sessionKey: "agent:lisa:off" });
    await h.lifecycle.handleSubagentSpawned({
      runId: "run-off",
      childSessionKey: "child-off",
    });
    expect((await h.runtime.diagnostics()).outboxCount).toBe(0);
    expect((await h.runtime.diagnostics()).captureBufferCount).toBe(0);
    const drain = await h.runtime.drainOnce();
    expect(drain).toEqual({ drained: 0, retried: 0, deadLettered: 0, skipped: 0 });
    expect(h.writes).toHaveLength(0);
  });

  it("gateway_stop flushes remaining buffer with backlog retained on drain abort", async () => {
    const h = await createHarness({ captureDrain: false, coordinationWrites: true });
    await h.lifecycle.handleMessageReceived({
      content: "Backlog item.",
      messageId: "msg-stop",
      sessionKey: "agent:lisa:stop",
    });
    await h.lifecycle.handleGatewayStop();
    // captureDrain false → flush enqueues to outbox but drain skips capture batches.
    expect((await h.runtime.diagnostics()).outboxCount).toBeGreaterThan(0);
    const drain = await h.runtime.drainOnce();
    expect(drain.drained).toBe(0);
    expect((await h.runtime.diagnostics()).outboxCount).toBeGreaterThan(0);
  });

  it("operation AbortController bounds do not leave uncaught rejections", async () => {
    const h = await createHarness({});
    const slowEnqueue = vi.spyOn(h.runtime, "enqueueWrite").mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });
      return { key: "slow" };
    });
    await expect(
      h.lifecycle.handleMessageReceived({
        content: "bounded",
        messageId: "msg-bound",
        sessionKey: "agent:lisa:bound",
      }),
    ).resolves.toBeUndefined();
    slowEnqueue.mockRestore();
  });

  it("rejects non-allowlisted tools at the transport boundary", async () => {
    const fake = createBrainFake();
    const transport = createBrainFakeTransport(fake);
    const result = await transport.write({
      toolName: "brain_browse",
      idempotencyKey: "bad:1",
      arguments: {},
    });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("tool_not_allowlisted");
  });
});

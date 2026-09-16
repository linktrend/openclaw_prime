// Store/config/workspace helpers and attempt mocks for the embedded-runner model-fallback e2e suite.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, vi, type Mock } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import type { AuthProfileFailureReason } from "./auth-profiles.js";
import { ensureAuthProfileStore, saveAuthProfileStore } from "./auth-profiles/store.js";
import type { EmbeddedRunAttemptResult } from "./embedded-agent-runner/run/types.js";
import { FailoverError } from "./failover-error.js";
import {
  buildEmbeddedRunnerAssistant,
  makeEmbeddedRunnerAttempt,
} from "./test-helpers/embedded-agent-runner-e2e-fixtures.js";

export function makeModelFallbackConfig(primaryProvider = "openai"): OpenClawConfig {
  const apiKeyField = ["api", "Key"].join("");
  return {
    agents: {
      defaults: {
        model: {
          primary: `${primaryProvider}/mock-1`,
          fallbacks: ["groq/mock-2"],
        },
      },
      list: [{ id: "test" }],
    },
    models: {
      providers: {
        [primaryProvider]: {
          api: "openai-responses",
          [apiKeyField]: `${primaryProvider}-test-key`, // pragma: allowlist secret
          baseUrl: `https://example.com/${primaryProvider}`,
          models: [
            {
              id: "mock-1",
              name: "Mock 1",
              reasoning: false,
              input: ["text"],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 16_000,
              maxTokens: 2048,
            },
          ],
        },
        groq: {
          api: "openai-responses",
          [apiKeyField]: "groq-test-key", // pragma: allowlist secret
          baseUrl: "https://example.com/groq",
          models: [
            {
              id: "mock-2",
              name: "Mock 2",
              reasoning: false,
              input: ["text"],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 16_000,
              maxTokens: 2048,
            },
          ],
        },
      },
    },
  } satisfies OpenClawConfig;
}

export async function withModelFallbackWorkspace<T>(
  fn: (ctx: { agentDir: string; workspaceDir: string }) => Promise<T>,
): Promise<T> {
  // Each e2e case gets isolated agent/workspace dirs because usage stats and
  // transcripts are part of the fallback behavior under test.
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-model-fallback-"));
  const agentDir = path.join(root, "agent");
  const workspaceDir = path.join(root, "workspace");
  await fs.mkdir(agentDir, { recursive: true });
  await fs.mkdir(workspaceDir, { recursive: true });
  try {
    return await fn({ agentDir, workspaceDir });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

export async function writeFallbackAuthStore(
  agentDir: string,
  usageStats?: Record<
    string,
    {
      lastUsed?: number;
      cooldownUntil?: number;
      disabledUntil?: number;
      disabledReason?: AuthProfileFailureReason;
      failureCounts?: Partial<Record<AuthProfileFailureReason, number>>;
    }
  >,
  options?: { primaryProvider?: string },
) {
  const primaryProvider = options?.primaryProvider ?? "openai";
  const primaryProfileId = `${primaryProvider}:p1`;
  saveAuthProfileStore(
    {
      version: 1,
      profiles: {
        [primaryProfileId]: {
          type: "api_key",
          provider: primaryProvider,
          key: "sk-primary",
        },
        "groq:p1": { type: "api_key", provider: "groq", key: "sk-groq" },
      },
      usageStats:
        usageStats ??
        ({
          [primaryProfileId]: { lastUsed: 1 },
          "groq:p1": { lastUsed: 2 },
        } as const),
    },
    agentDir,
  );
}

export async function readFallbackUsageStats(agentDir: string) {
  return ensureAuthProfileStore(agentDir, { syncExternalCli: false }).usageStats ?? {};
}

export async function writeFallbackMultiProfileAuthStore(
  agentDir: string,
  options?: { openAiProfileCount?: 2 | 3 },
) {
  const includeThirdOpenAiProfile = options?.openAiProfileCount !== 2;
  saveAuthProfileStore(
    {
      version: 1,
      profiles: {
        "openai:p1": { type: "api_key", provider: "openai", key: "sk-openai-1" },
        "openai:p2": { type: "api_key", provider: "openai", key: "sk-openai-2" },
        ...(includeThirdOpenAiProfile
          ? { "openai:p3": { type: "api_key" as const, provider: "openai", key: "placeholder" } }
          : {}),
        "groq:p1": { type: "api_key", provider: "groq", key: "sk-groq" },
      },
      usageStats: {
        "openai:p1": { lastUsed: 1 },
        "openai:p2": { lastUsed: 2 },
        ...(includeThirdOpenAiProfile ? { "openai:p3": { lastUsed: 3 } } : {}),
        "groq:p1": { lastUsed: 4 },
      },
    },
    agentDir,
  );
}

export function makeSolLunaFallbackConfig(): OpenClawConfig {
  const apiKeyField = ["api", "Key"].join("");
  return {
    agents: {
      defaults: {
        model: {
          primary: "openai/gpt-5.6-sol",
          fallbacks: ["openrouter/openai/gpt-5.6-luna"],
        },
        models: {
          "openai/gpt-5.6-sol": { params: { reasoning: { effort: "low" } } },
          "openrouter/openai/gpt-5.6-luna": { params: { reasoning: { effort: "high" } } },
        },
      },
      list: [{ id: "test" }],
    },
    models: {
      providers: {
        openai: {
          api: "openai-responses",
          [apiKeyField]: "openai-test-key",
          baseUrl: "https://example.com/openai",
          models: [
            {
              id: "gpt-5.6-sol",
              name: "GPT 5.6 Sol",
              reasoning: true,
              input: ["text"],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 16_000,
              maxTokens: 2048,
            },
          ],
        },
        openrouter: {
          api: "openai-responses",
          [apiKeyField]: "openrouter-test-key",
          baseUrl: "https://example.com/openrouter",
          models: [
            {
              id: "openai/gpt-5.6-luna",
              name: "GPT 5.6 Luna",
              reasoning: true,
              input: ["text"],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 16_000,
              maxTokens: 2048,
            },
          ],
        },
      },
    },
  } satisfies OpenClawConfig;
}

export function writeSolLunaAuthStore(agentDir: string) {
  saveAuthProfileStore(
    {
      version: 1,
      profiles: {
        "openai:p1": { type: "api_key", provider: "openai", key: "sk-primary" },
        "openrouter:p1": { type: "api_key", provider: "openrouter", key: "sk-openrouter" },
      },
      usageStats: {
        "openai:p1": { lastUsed: 1 },
        "openrouter:p1": { lastUsed: 2 },
      },
    },
    agentDir,
  );
}

export type EmbeddedAttemptParams = {
  provider: string;
  modelId?: string;
  authProfileId?: string;
  runtimePlan?: {
    transport?: {
      extraParams?: Record<string, unknown>;
    };
  };
};

export function createEmbeddedFallbackAttemptMocks(params: {
  runEmbeddedAttemptMock: Mock<(params: unknown) => Promise<EmbeddedRunAttemptResult>>;
  overloadedPayload: string;
  rateLimitMessage: string;
}) {
  const { runEmbeddedAttemptMock, overloadedPayload, rateLimitMessage } = params;

  function makeFallbackSuccessAttempt(): EmbeddedRunAttemptResult {
    return makeEmbeddedRunnerAttempt({
      assistantTexts: ["fallback ok"],
      lastAssistant: buildEmbeddedRunnerAssistant({
        provider: "groq",
        model: "mock-2",
        stopReason: "stop",
        content: [{ type: "text", text: "fallback ok" }],
      }),
    });
  }

  function mockPrimaryFailureThenFallbackSuccess(
    makePrimaryAttempt: (
      attemptParams: EmbeddedAttemptParams,
    ) => EmbeddedRunAttemptResult | Promise<EmbeddedRunAttemptResult>,
    options?: { primaryProvider?: string },
  ) {
    const primaryProvider = options?.primaryProvider ?? "openai";
    runEmbeddedAttemptMock.mockImplementation(async (attemptParams: unknown) => {
      const typed = attemptParams as EmbeddedAttemptParams;
      if (typed.provider === primaryProvider) {
        return await makePrimaryAttempt(typed);
      }
      if (typed.provider === "groq") {
        return makeFallbackSuccessAttempt();
      }
      throw new Error(`Unexpected provider ${typed.provider}`);
    });
  }

  function mockPrimaryErrorThenFallbackSuccess(
    errorMessage: string,
    options?: { primaryProvider?: string },
  ) {
    mockPrimaryFailureThenFallbackSuccess(
      (attemptParams) =>
        makeEmbeddedRunnerAttempt({
          assistantTexts: [],
          lastAssistant: buildEmbeddedRunnerAssistant({
            provider: attemptParams.provider,
            model: attemptParams.modelId ?? "mock-1",
            stopReason: "error",
            errorMessage,
          }),
        }),
      options,
    );
  }

  return {
    mockPrimaryOverloadedThenFallbackSuccess: () =>
      mockPrimaryErrorThenFallbackSuccess(overloadedPayload),
    mockPrimaryFailureThenFallbackSuccess,
    mockPrimaryPromptErrorThenFallbackSuccess: (errorMessage: string) =>
      mockPrimaryFailureThenFallbackSuccess(() =>
        makeEmbeddedRunnerAttempt({
          terminal: { kind: "failed", source: "prompt", error: new Error(errorMessage) },
        }),
      ),
    mockPrimarySuspendingPromptErrorThenFallbackSuccess: (sessionId: string) =>
      mockPrimaryFailureThenFallbackSuccess(() =>
        makeEmbeddedRunnerAttempt({
          sessionIdUsed: sessionId,
          terminal: {
            kind: "failed",
            source: "prompt",
            error: new FailoverError(rateLimitMessage, {
              reason: "rate_limit",
              provider: "openai",
              model: "mock-1",
              suspend: true,
            }),
          },
        }),
      ),
    mockPrimaryErrorThenFallbackSuccess,
    mockPrimaryStaleRateLimitTextSuccess: (errorMessage: string) =>
      mockPrimaryFailureThenFallbackSuccess(() =>
        makeEmbeddedRunnerAttempt({
          assistantTexts: ["primary ok"],
          lastAssistant: buildEmbeddedRunnerAssistant({
            provider: "openai",
            model: "mock-1",
            stopReason: "stop",
            content: [{ type: "text", text: "primary ok" }],
            errorMessage,
          }),
        }),
      ),
    expectAttemptOrder: (expected: Array<{ provider: string; authProfileId: string }>) => {
      expect(
        runEmbeddedAttemptMock.mock.calls.map(([callParams]) => {
          const attempt = callParams as EmbeddedAttemptParams;
          return { provider: attempt.provider, authProfileId: attempt.authProfileId };
        }),
      ).toEqual(expected);
    },
    expectOpenAiThenGroqAttemptOrder: (options?: { primaryAttempts?: number }) => {
      expect(
        runEmbeddedAttemptMock.mock.calls.map(([callParams]) => {
          const attempt = callParams as EmbeddedAttemptParams;
          return { provider: attempt.provider, authProfileId: attempt.authProfileId };
        }),
      ).toEqual([
        ...Array.from({ length: options?.primaryAttempts ?? 1 }, () => ({
          provider: "openai",
          authProfileId: "openai:p1",
        })),
        { provider: "groq", authProfileId: "groq:p1" },
      ]);
    },
    mockAllProvidersOverloaded: () => {
      runEmbeddedAttemptMock.mockImplementation(async (attemptParams: unknown) => {
        const typed = attemptParams as EmbeddedAttemptParams;
        if (typed.provider === "openai" || typed.provider === "groq") {
          return makeEmbeddedRunnerAttempt({
            assistantTexts: [],
            lastAssistant: buildEmbeddedRunnerAssistant({
              provider: typed.provider,
              model: typed.provider === "openai" ? "mock-1" : "mock-2",
              stopReason: "error",
              errorMessage: overloadedPayload,
            }),
          });
        }
        throw new Error(`Unexpected provider ${typed.provider}`);
      });
    },
    expectProviderAttemptCounts: (expected: { openai: number; groq: number }) => {
      const count = (provider: string) =>
        runEmbeddedAttemptMock.mock.calls.filter(
          (call) => (call[0] as { provider?: string })?.provider === provider,
        ).length;
      expect(count("openai")).toBe(expected.openai);
      expect(count("groq")).toBe(expected.groq);
    },
    countProviderAttempts: (provider: string) =>
      runEmbeddedAttemptMock.mock.calls.filter(
        (call) => (call[0] as { provider?: string })?.provider === provider,
      ).length,
  };
}

export type ExtraParamsInvocation = {
  provider: string;
  modelId: string;
  reasoning: unknown;
};

export function readAttemptInvocationArgs(
  runEmbeddedAttemptMock: Mock<(params: unknown) => Promise<EmbeddedRunAttemptResult>>,
): ExtraParamsInvocation[] {
  return runEmbeddedAttemptMock.mock.calls.map(([params]) => {
    const attempt = params as EmbeddedAttemptParams;
    return {
      provider: attempt.provider,
      modelId: attempt.modelId ?? "",
      reasoning: attempt.runtimePlan?.transport?.extraParams?.reasoning,
    };
  });
}

export async function withResolvedAttemptExtraParams<T>(
  fn: (extraParamsInvocations: ExtraParamsInvocation[]) => Promise<T>,
): Promise<T> {
  const { buildAgentRuntimePlan } = await import("./runtime-plan/build.js");
  const { resolveExtraParams } = await import("./embedded-agent-runner/extra-params.js");
  const mocked = vi.mocked(buildAgentRuntimePlan);
  const previous = mocked.getMockImplementation();
  if (!previous) {
    throw new Error("expected mocked buildAgentRuntimePlan");
  }
  const extraParamsInvocations: ExtraParamsInvocation[] = [];
  mocked.mockImplementation((params) => {
    const plan = previous(params) as {
      transport: {
        extraParams: Record<string, unknown>;
        resolveExtraParams: () => Record<string, unknown>;
      };
    };
    const extraParams =
      resolveExtraParams({
        cfg: (params as { config?: OpenClawConfig }).config,
        provider: params.provider,
        modelId: params.modelId,
        agentId: (params as { agentId?: string }).agentId,
      }) ?? {};
    extraParamsInvocations.push({
      provider: params.provider,
      modelId: params.modelId,
      reasoning: extraParams.reasoning,
    });
    return {
      ...plan,
      transport: {
        ...plan.transport,
        extraParams,
        resolveExtraParams: () => extraParams,
      },
    };
  });
  try {
    return await fn(extraParamsInvocations);
  } finally {
    mocked.mockImplementation(previous);
  }
}

export function createEmbeddedFallbackRunners(params: {
  runWithModelFallback: typeof import("./model-fallback-runner.js").runWithModelFallback;
  runEmbeddedAgent: (runParams: Record<string, unknown>) => Promise<unknown>;
  runEmbeddedAgentWithPreparedAdmission: (runParams: Record<string, unknown>) => Promise<unknown>;
  runEmbeddedAgentEntry: typeof import("./embedded-agent-runner/run-entry.js").runEmbeddedAgentEntry;
  createModelRoutingTestAdmission: typeof import("./test-helpers/model-routing-decision-e2e-fixtures.js").createModelRoutingTestAdmission;
  observedModelRoutingProvenance: Array<{
    stage: "initial" | "fallback";
    fallbackReason?: string;
  }>;
}) {
  async function runEmbeddedFallback(runParams: {
    agentDir: string;
    workspaceDir: string;
    sessionKey: string;
    runId: string;
    provider?: string;
    sessionId?: string;
    lane?: string;
    abortSignal?: AbortSignal;
    config?: OpenClawConfig;
  }) {
    const cfg = runParams.config ?? makeModelFallbackConfig();
    const sessionId = runParams.sessionId ?? `session:${runParams.runId}`;
    return await params.runWithModelFallback({
      cfg,
      provider: runParams.provider ?? "openai",
      model: "mock-1",
      runId: runParams.runId,
      sessionId: runParams.sessionId,
      lane: runParams.lane,
      agentDir: runParams.agentDir,
      abortSignal: runParams.abortSignal,
      run: (provider, model, options) =>
        params.runEmbeddedAgent({
          sessionId,
          sessionKey: runParams.sessionKey,
          workspaceDir: runParams.workspaceDir,
          agentDir: runParams.agentDir,
          config: cfg,
          prompt: "hello",
          provider,
          model,
          lane: runParams.lane,
          authProfileIdSource: "auto",
          allowTransientCooldownProbe: options?.allowTransientCooldownProbe,
          isFinalFallbackAttempt: options?.isFinalFallbackAttempt,
          timeoutMs: 5_000,
          runId: runParams.runId,
          abortSignal: runParams.abortSignal,
          enqueue: async (task: () => unknown) => await task(),
        }),
    });
  }

  async function runEmbeddedEntryFallback(runParams: {
    agentDir: string;
    workspaceDir: string;
    sessionKey: string;
    runId: string;
    config?: OpenClawConfig;
    provider?: string;
    model?: string;
    fallbacksOverride?: string[];
    modelFallbackAvailability?: import("./agent-scope.js").ModelFallbackAvailability;
    onFallbackStep?: (step: import("./model-fallback-observation.js").ModelFallbackStepFields) => void;
  }) {
    const cfg = runParams.config ?? makeModelFallbackConfig();
    const sessionId = `session:${runParams.runId}`;
    const provider = runParams.provider ?? "openai";
    const model = runParams.model ?? "mock-1";
    const preparedRunAdmission = params.createModelRoutingTestAdmission({
      cfg: { ...cfg, logging: { audit: { executionIdentity: true } } },
      runId: runParams.runId,
      boundary: "model-fallback-e2e",
    });
    try {
      return await params.runEmbeddedAgentEntry({
        selection: {
          cfg,
          provider,
          model,
          agentDir: runParams.agentDir,
          manifestPlugins: [],
          fallbacksOverride: runParams.fallbacksOverride,
        },
        identity: {
          runId: runParams.runId,
          agentId: "test",
          sessionId,
          sessionKey: runParams.sessionKey,
        },
        harness: {
          workspaceDir: runParams.workspaceDir,
          sessionKey: runParams.sessionKey,
          preparation: { kind: "direct" },
          resolveRuntimeOverride: () => undefined,
          resolveContextEngineHost: (candidateProvider, candidateModel) => ({
            id: `embedded-e2e:${candidateProvider}/${candidateModel}`,
            label: "embedded runner e2e",
            capabilities: [],
          }),
        },
        behavior: { kind: "maintenance" },
        sessionOverride: { kind: "preserve" },
        onFallbackStep: runParams.onFallbackStep,
        runCandidate: (candidateProvider, candidateModel, options) => {
          params.observedModelRoutingProvenance.push(options.modelRoutingProvenance);
          return params.runEmbeddedAgentWithPreparedAdmission({
            preparedRunAdmission,
            sessionId,
            sessionKey: runParams.sessionKey,
            workspaceDir: runParams.workspaceDir,
            agentDir: runParams.agentDir,
            config: cfg,
            ...(runParams.modelFallbackAvailability
              ? { modelFallbackAvailability: runParams.modelFallbackAvailability }
              : {}),
            prompt: "hello",
            provider: candidateProvider,
            model: candidateModel,
            modelRoutingProvenance: options.modelRoutingProvenance,
            authProfileIdSource: "auto",
            isFinalFallbackAttempt: options.isFinalFallbackAttempt,
            timeoutMs: 5_000,
            runId: runParams.runId,
            enqueue: async (task: () => unknown) => await task(),
            contextEngineLogicalTurnLease: options.contextEngineLogicalTurnLease,
            onContextEngineTurnCandidate: options.onContextEngineTurnCandidate,
          });
        },
      });
    } finally {
      preparedRunAdmission.close();
    }
  }

  return { runEmbeddedFallback, runEmbeddedEntryFallback };
}

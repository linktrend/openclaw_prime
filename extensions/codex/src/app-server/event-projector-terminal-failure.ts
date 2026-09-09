import {
  agentHarnessAttemptTerminal,
  formatErrorMessage,
} from "openclaw/plugin-sdk/agent-harness-runtime";
import type { AttemptFailureSource } from "./attempt-terminal.js";
import { readCodexProviderRefusal, type CodexProviderRefusal } from "./event-projector-values.js";
import type { JsonValue } from "./protocol.js";
import { resolveCodexPromptError } from "./usage-limit-error.js";

function readPromptErrorMessage(promptError: unknown): string {
  if (typeof promptError === "string") {
    return promptError.trim();
  }
  if (promptError instanceof Error) {
    return promptError.message.trim();
  }
  return promptError ? formatErrorMessage(promptError).trim() : "";
}

/** Prefer OpenClaw-owned refresh provenance when Codex maps the JSON-RPC failure. */
export function resolveCodexExternalAuthRefreshPromptError(
  promptError: unknown,
  stashed?: unknown,
): unknown {
  const projectedKind = agentHarnessAttemptTerminal.externalAuthRefresh.classify(promptError);
  const stashedKind = agentHarnessAttemptTerminal.externalAuthRefresh.classify(stashed);
  if (stashedKind && (projectedKind?.kind === "refresh_failed" || promptError == null)) {
    return stashed;
  }
  const message = readPromptErrorMessage(promptError);
  return (
    agentHarnessAttemptTerminal.externalAuthRefresh.materializePromptError({
      message,
      cause: promptError instanceof Error ? promptError : undefined,
    }) ?? promptError
  );
}

export class CodexTerminalFailureProjection {
  promptError: unknown;
  promptErrorSource: AttemptFailureSource | null = null;
  providerRefusal: CodexProviderRefusal | undefined;

  record(params: {
    message: string | undefined;
    codexErrorInfo: JsonValue | null | undefined;
    rateLimits: JsonValue | undefined;
    fallbackMessage: string;
    promptErrorSource: AttemptFailureSource;
  }): void {
    this.providerRefusal ??= readCodexProviderRefusal(params.message, params.codexErrorInfo);
    if (this.providerRefusal) {
      return;
    }
    const resolved =
      resolveCodexPromptError({
        message: params.message,
        codexErrorInfo: params.codexErrorInfo,
        rateLimits: params.rateLimits,
      }) ?? params.fallbackMessage;
    this.promptError = resolveCodexExternalAuthRefreshPromptError(resolved);
    this.promptErrorSource = params.promptErrorSource;
  }
}

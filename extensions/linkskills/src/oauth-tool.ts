import { randomUUID } from "node:crypto";
import { Type } from "typebox";
import type { OpenClawPluginApi } from "../runtime-api.js";
import { parseLinkskillsConfig, type LinkskillsConfig } from "./config.js";
import { rejectNonStandardSkillsMcpOperation } from "./standard-mcp-v2.js";
import { callLinkskillsHttpTool, callLinkskillsMcpTool } from "./transport.js";
import {
  SKILLS_V2_OPERATIONS,
  SKILLS_V2_RESOURCE_OPERATIONS,
  SKILLS_V2_TOOL_OPERATIONS,
} from "./v2.js";

const discoveryOperations = SKILLS_V2_RESOURCE_OPERATIONS;
const telemetryOperations = ["skills_feedback_submit"] as const;
const governedOperationSet = new Set(
  SKILLS_V2_TOOL_OPERATIONS.filter((operation) => operation !== "skills_feedback_submit"),
);

const skillsSchema = Type.Object(
  {
    operation: Type.Enum(SKILLS_V2_OPERATIONS, { type: "string" }),
    arguments: Type.Record(Type.String(), Type.Unknown()),
  },
  { additionalProperties: false },
);

const prohibitedActorFields = new Set(["actor_id", "actorId", "platformActorId", "actorBindingId"]);

function hasActorOverride(value: Record<string, unknown>): boolean {
  return Object.keys(value).some((key) => prohibitedActorFields.has(key));
}

function boundedJson(value: unknown): string {
  const text = JSON.stringify(value ?? {});
  return text.length <= 24_000 ? text : `${text.slice(0, 24_000)}…[truncated]`;
}

function nativeIdempotencyKey(): string {
  return `openclaw:${randomUUID()}`;
}

/**
 * A local Skills bridge. Discovery and governed execution have independent
 * feature gates; no machine token is returned to the calling model.
 */
export function createLinkskillsTool(api: OpenClawPluginApi, deps?: { fetchImpl?: typeof fetch }) {
  return {
    name: "linkskills_use",
    label: "LiNKskills",
    description: "Discover or use an authorised published LiNKskills capability.",
    parameters: skillsSchema,
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      let config: LinkskillsConfig;
      try {
        config = parseLinkskillsConfig(api.pluginConfig);
      } catch {
        return {
          content: [{ type: "text" as const, text: "LiNKskills configuration is unavailable." }],
          details: { ok: false, reason: "configuration_unavailable" },
        };
      }
      const operation = params.operation;
      const argumentsValue = params.arguments;
      if (
        typeof operation !== "string" ||
        typeof argumentsValue !== "object" ||
        argumentsValue === null ||
        Array.isArray(argumentsValue)
      ) {
        return {
          content: [{ type: "text" as const, text: "Invalid LiNKskills request." }],
          details: { ok: false, reason: "invalid_request" },
        };
      }
      if (hasActorOverride(argumentsValue as Record<string, unknown>)) {
        return {
          content: [{ type: "text" as const, text: "Actor identity is assigned by LiNKskills." }],
          details: { ok: false, reason: "actor_override_rejected" },
        };
      }
      const rejected = rejectNonStandardSkillsMcpOperation(operation);
      if (rejected) {
        return {
          content: [{ type: "text" as const, text: "That LiNKskills capability is not allowed." }],
          details: {
            ok: false,
            reason: rejected === "legacy_execution_disabled" ? rejected : "operation_not_allowed",
          },
        };
      }
      const discovery = (discoveryOperations as readonly string[]).includes(operation);
      const governed = governedOperationSet.has(operation);
      const telemetry = (telemetryOperations as readonly string[]).includes(operation);
      if (!discovery && !governed && !telemetry) {
        return {
          content: [{ type: "text" as const, text: "That LiNKskills capability is not allowed." }],
          details: { ok: false, reason: "operation_not_allowed" },
        };
      }
      if (
        (discovery && !config.mcpDiscoveryRead) ||
        (governed && !config.governedExecution) ||
        (telemetry && !config.telemetryEnqueue)
      ) {
        return {
          content: [{ type: "text" as const, text: "That LiNKskills capability is disabled." }],
          details: { ok: false, reason: "disabled" },
        };
      }
      const result =
        config.transportMode === "http"
          ? await callLinkskillsHttpTool({
              api,
              config,
              toolName: operation,
              arguments: argumentsValue as Record<string, unknown>,
              idempotencyKey: nativeIdempotencyKey(),
              ...(deps?.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
            })
          : await callLinkskillsMcpTool({
              api,
              config,
              toolName: operation,
              arguments: argumentsValue as Record<string, unknown>,
            });
      return {
        content: [
          {
            type: "text" as const,
            text: result.ok
              ? boundedJson(result.result)
              : `LiNKskills request failed: ${result.safeMessage}`,
          },
        ],
        details: result.ok
          ? { ok: true, result: result.result ?? {} }
          : { ok: false, reason: result.safeMessage },
      };
    },
  };
}

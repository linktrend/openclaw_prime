/**
 * Standard MCP v2 Skills consumer surface (sessionless skills.api.v0.2).
 * Legacy v1 run/invoke names stay behind LINKSKILLS_LEGACY_MCP_COMPATIBILITY_CONTRACT.
 */
import { SKILLS_V2_OPERATIONS, isModernSkillsOperation } from "./v2.js";

const LEGACY_EXECUTION = /^(skills_run_|skills_tool_)/;

export const SKILLS_STANDARD_MCP_OPERATIONS = SKILLS_V2_OPERATIONS;

export function isLegacySkillsExecutionOperation(toolName: string): boolean {
  return LEGACY_EXECUTION.test(toolName);
}

export function isStandardSkillsMcpOperation(toolName: string): boolean {
  return isModernSkillsOperation(toolName);
}

/** Native/MCP consumer calls fail closed unless the name is a v2 operation. */
export function rejectNonStandardSkillsMcpOperation(toolName: string): string | undefined {
  if (isStandardSkillsMcpOperation(toolName)) {
    return undefined;
  }
  if (isLegacySkillsExecutionOperation(toolName)) {
    return "legacy_execution_disabled";
  }
  return "tool_not_allowlisted";
}

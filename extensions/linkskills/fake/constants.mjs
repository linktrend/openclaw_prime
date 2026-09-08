/** Shared constants for the LiNKskills OpenClaw fake. */

export const CONTRACT_VERSION = "0.1";
export const API_VERSION = "skills.api.v0.1";
export const SERVICE_NAME = "linkskills-fake";
export const FIXED_SERVER_TIME = "2026-07-27T10:00:00Z";

export const AUDIENCE = "linkskills";
export const REQUIRED_SCOPES = Object.freeze(["skills:read", "skills:write"]);
export const REVOKED_CREDENTIAL_IDS = Object.freeze(["cred:fixture-revoked-01"]);

export const FIXTURE_SKILL = Object.freeze({
  skill_id: "skill.fixture.echo",
  version: "1.0.0",
  description: "Sanitized echo skill for contract fixtures.",
  format_profile: "simple",
  certification_state: "usable",
  category: "general",
  usage_trigger: "echo structured input",
  release_hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  profile_hash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  fragment_id: "overview",
  fragment_text: "# Fixture echo skill\nStructured overview only.",
  fragment_content_hash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  tool_id: "skill.fixture.echo.echo",
  tool_version: "1.0.0",
  tool_descriptor_hash: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
});

export const OPERATIONS = Object.freeze([
  "skills_list",
  "skills_search",
  "skills_describe",
  "skills_fragment_get",
  "skills_release_get",
  "skills_run_start",
  "skills_run_update",
  "skills_run_complete",
  "skills_run_fail",
  "skills_tool_resolve",
  "skills_tool_invoke",
  "skills_input_validate",
  "skills_output_validate",
  "skills_feedback_submit",
  "skills_trace_candidate_submit",
]);

export const WRITE_OPERATIONS = Object.freeze(
  new Set([
    "skills_run_start",
    "skills_run_update",
    "skills_run_complete",
    "skills_run_fail",
    "skills_tool_invoke",
    "skills_feedback_submit",
    "skills_trace_candidate_submit",
  ]),
);

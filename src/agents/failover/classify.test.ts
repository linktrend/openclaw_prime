import { describe, expect, it } from "vitest";
import { classifyFailoverReason } from "./classify.js";

describe("Claude CLI logged-out failures", () => {
  const loggedOutMessage = "Not logged in · Please run /login";

  it("classifies the logged-out response as auth only for claude-cli", () => {
    expect(classifyFailoverReason(loggedOutMessage, { provider: "claude-cli" })).toBe("auth");
    expect(classifyFailoverReason(loggedOutMessage, { provider: "openai" })).toBeNull();
    expect(classifyFailoverReason(loggedOutMessage)).toBeNull();
  });
});

describe("OAuth session expiry", () => {
  const expiredMessage = "Failed to authenticate: OAuth session expired and could not be refreshed";

  it("classifies OAuth expiry as auth only for claude-cli", () => {
    expect(classifyFailoverReason(expiredMessage, { provider: "claude-cli" })).toBe("auth");
    expect(classifyFailoverReason(expiredMessage, { provider: "custom-cli" })).toBe(
      "session_expired",
    );
    expect(classifyFailoverReason(expiredMessage)).toBe("session_expired");
  });
});

describe("Codex app-server external-auth refresh failover", () => {
  it("classifies mapped refresh-failed copy as auth_permanent without treating -32603 as the reason", () => {
    expect(classifyFailoverReason("auth refresh request failed: code=-32603")).toBe(
      "auth_permanent",
    );
    expect(classifyFailoverReason("auth refresh request failed: code=0")).toBe("auth_permanent");
    expect(classifyFailoverReason("Internal error (-32603): store hiccup")).toBeNull();
    expect(classifyFailoverReason("JSON-RPC error -32603 Internal error")).toBeNull();
  });

  it("distinguishes Codex refresh timeout and cancellation from refresh-failed", () => {
    expect(classifyFailoverReason("auth refresh request timed out after 10s")).toBe("timeout");
    expect(classifyFailoverReason("auth refresh request timed out after 9s")).toBe("timeout");
    expect(classifyFailoverReason("auth refresh request canceled: operator abort")).toBeNull();
  });
});

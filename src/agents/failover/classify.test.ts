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
  it("does not treat Codex refresh literals or generic -32603 as failover without a typed stamp", () => {
    expect(classifyFailoverReason("auth refresh request failed: code=-32603")).toBeNull();
    expect(classifyFailoverReason("auth refresh request failed: code=0")).toBeNull();
    expect(classifyFailoverReason("invalid auth refresh response")).toBeNull();
    expect(classifyFailoverReason("auth refresh returned invalid credentials")).toBeNull();
    expect(classifyFailoverReason("external auth lock is poisoned")).toBeNull();
    expect(classifyFailoverReason("Internal error (-32603): store hiccup")).toBeNull();
    expect(classifyFailoverReason("JSON-RPC error -32603 Internal error")).toBeNull();
  });

  it("does not classify Codex refresh cancellation copy as generic failover", () => {
    expect(classifyFailoverReason("auth refresh request canceled: operator abort")).toBeNull();
  });
});

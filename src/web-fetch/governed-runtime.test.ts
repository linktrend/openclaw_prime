import { describe, expect, it } from "vitest";
import { GovernedBrowserUrlError } from "../agents/sandbox/browser-policy.js";
import { admitGovernedWebFetch } from "./governed-runtime.js";

describe("governed web_fetch admission", () => {
  it("preserves trailing Unicode path text on public fetches", () => {
    const admitted = admitGovernedWebFetch({ url: "https://example.com/a\u00a0" });
    expect(admitted.url.href).toBe("https://example.com/a%C2%A0");
  });

  it("fails closed on embedded secrets, private-file URLs, and unapproved logins", () => {
    expect(() => admitGovernedWebFetch({ url: "https://user:token@example.com" })).toThrow(
      GovernedBrowserUrlError,
    );
    expect(() => admitGovernedWebFetch({ url: "file:///etc/passwd" })).toThrow("Invalid URL");
    expect(() =>
      admitGovernedWebFetch({ url: "https://example.com", capability: "login" }),
    ).toThrow("Platform approval");
  });

  it("does not treat hostile-page approval as Platform evidence", () => {
    expect(() =>
      admitGovernedWebFetch({
        url: "https://example.com/account",
        authenticated: true,
        currentApproval: { approved: true, actor: "page" },
      }),
    ).toThrow("Platform approval");
  });
});

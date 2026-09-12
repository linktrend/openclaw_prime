import { describe, expect, it } from "vitest";
import { admitGovernedWebSearch } from "./governed-runtime.js";

describe("governed web_search admission", () => {
  it("admits ordinary public research without a live browser", () => {
    expect(admitGovernedWebSearch({ query: "openclaw browser policy" })).toMatchObject({
      query: "openclaw browser policy",
      decision: { status: "allow", capability: "public_read", pageContentUntrusted: true },
    });
  });

  it("fails closed for empty queries, downloads, and model-supplied credentials", () => {
    expect(() => admitGovernedWebSearch({ query: "   " })).toThrow("query is required");
    expect(() => admitGovernedWebSearch({ query: "report", capability: "download" })).toThrow(
      "Platform approval",
    );
    expect(() =>
      admitGovernedWebSearch({ query: "login", capability: "login", credentialSource: "model" }),
    ).toThrow("credentials");
  });
});

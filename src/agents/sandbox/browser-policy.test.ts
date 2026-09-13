import { describe, expect, it, vi } from "vitest";
import type { LookupFn } from "../../infra/net/ssrf.js";
import {
  admitBrowserSession,
  assertGovernedBrowserRedirectChain,
  assertGovernedBrowserUrl,
  evaluateBrowserCapability,
  GOVERNED_BROWSER_RUNTIME_MODE,
  parseGovernedBrowserUrl,
  resolveGovernedBrowserUrl,
  resolveBrowserDownloadPath,
  resolveBrowserDownloadPolicy,
  resolveBrowserRuntimeLimits,
  startGovernedBrowserRuntime,
} from "./browser-policy.js";

const publicLookup = (async (_hostname: string, _options: { all: true }) => [
  { address: "93.184.216.34", family: 4 as const },
]) as unknown as LookupFn;
const privateLookup = (async (_hostname: string, _options: { all: true }) => [
  { address: "127.0.0.1", family: 4 as const },
]) as unknown as LookupFn;

describe("governed browser capability policy", () => {
  it("allows public reads while marking page content untrusted", () => {
    expect(evaluateBrowserCapability({ capability: "public_read" })).toMatchObject({
      status: "allow",
      pageContentUntrusted: true,
    });
  });

  it("requires Platform approval for authenticated reads and ignores page approval", () => {
    expect(
      evaluateBrowserCapability({
        capability: "public_read",
        authenticated: true,
        currentApproval: { approved: true, actor: "page" },
      }),
    ).toMatchObject({ status: "ask", capability: "approved_authenticated_read" });

    expect(
      evaluateBrowserCapability({
        capability: "approved_authenticated_read",
        currentApproval: { approved: true, actor: "platform" },
      }),
    ).toMatchObject({ status: "allow" });
  });

  it("fails closed for credentials, uncertain identity, challenges, and self-approval", () => {
    expect(
      evaluateBrowserCapability({ capability: "login", credentialSource: "model" }),
    ).toMatchObject({ status: "deny" });
    expect(
      evaluateBrowserCapability({ capability: "form_submission", identityUncertain: true }),
    ).toMatchObject({ status: "deny" });
    expect(evaluateBrowserCapability({ capability: "upload", botProtection: true })).toMatchObject({
      status: "deny",
    });
    expect(evaluateBrowserCapability({ capability: "terms", termsUnclear: true })).toMatchObject({
      status: "deny",
    });
    expect(
      evaluateBrowserCapability({ capability: "login", activateStandingRule: true }),
    ).toMatchObject({ status: "deny" });
  });

  it("asks before purchase or external commitment without a current Platform claim", () => {
    expect(evaluateBrowserCapability({ capability: "purchase" })).toMatchObject({
      status: "ask",
    });
    expect(evaluateBrowserCapability({ capability: "external_commitment" })).toMatchObject({
      status: "ask",
    });
  });
});

describe("governed browser URL policy", () => {
  it("allows only about:blank as a non-network bootstrap URL", () => {
    expect(parseGovernedBrowserUrl("about:blank").href).toBe("about:blank");
    expect(() => parseGovernedBrowserUrl("file:///tmp/secret")).toThrow("unsupported");
    expect(() => parseGovernedBrowserUrl("https://user:password@example.com")).toThrow(
      "credentials",
    );
  });

  it("blocks private literal and DNS-rebinding targets", async () => {
    await expect(
      assertGovernedBrowserUrl("http://127.0.0.1:8080", { lookupFn: publicLookup }),
    ).rejects.toThrow("private");
    await expect(
      assertGovernedBrowserUrl("https://public.example", { lookupFn: privateLookup }),
    ).rejects.toThrow("private");
  });

  it("validates public DNS results and enforces redirect bounds", async () => {
    await expect(
      assertGovernedBrowserUrl("https://public.example", { lookupFn: publicLookup }),
    ).resolves.toMatchObject({ hostname: "public.example" });
    await expect(
      assertGovernedBrowserRedirectChain(
        ["https://public.example", "https://public.example/next"],
        {
          lookupFn: publicLookup,
          maxRedirects: 1,
        },
      ),
    ).resolves.toHaveLength(2);
    await expect(
      assertGovernedBrowserRedirectChain(
        ["https://public.example", "https://public.example/1", "https://public.example/2"],
        { lookupFn: publicLookup, maxRedirects: 1 },
      ),
    ).rejects.toThrow("redirect limit");
  });

  it("retains a checked DNS answer for the browser driver boundary", async () => {
    const lookupFn = vi.fn(publicLookup);
    const admitted = await resolveGovernedBrowserUrl("https://public.example", { lookupFn });
    const rebound = await resolveGovernedBrowserUrl("https://public.example/next", {
      lookupFn: privateLookup,
      pinnedHostname: admitted.pinnedHostname,
    });
    expect(admitted.pinnedHostname?.addresses).toEqual(["93.184.216.34"]);
    expect(rebound.pinnedHostname).toBe(admitted.pinnedHostname);
    expect(lookupFn).toHaveBeenCalledTimes(1);
  });
});

describe("browser lifecycle and download limits", () => {
  it("normalizes bounded defaults and rejects over-budget sessions", () => {
    expect(resolveBrowserRuntimeLimits({ maxConcurrentSessions: 0 })).toMatchObject({
      maxConcurrentSessions: 2,
      maxMemoryMb: 1_024,
    });
    expect(admitBrowserSession({}, { activeSessions: 2 })).toMatchObject({ allowed: false });
    expect(
      admitBrowserSession({ maxMemoryMb: 256 }, { activeSessions: 0, estimatedMemoryMb: 257 }),
    ).toMatchObject({ allowed: false });
    expect(admitBrowserSession({}, { activeSessions: 0, estimatedMemoryMb: 128 })).toEqual({
      allowed: true,
    });
  });

  it("isolates downloads and never enables open or execution", () => {
    const policy = resolveBrowserDownloadPolicy("/tmp/lisa-browser");
    expect(policy).toMatchObject({
      directory: "/tmp/lisa-browser/downloads",
      openAfterDownload: false,
      executeAfterDownload: false,
    });
    expect(resolveBrowserDownloadPath(policy, "report.pdf")).toBe(
      "/tmp/lisa-browser/downloads/report.pdf",
    );
    expect(() => resolveBrowserDownloadPath(policy, "../report.pdf")).toThrow("inside");
    expect(() => resolveBrowserDownloadPath(policy, "/tmp/report.pdf")).toThrow("inside");
  });

  it("never starts a live browser from this source-only packet", () => {
    expect(GOVERNED_BROWSER_RUNTIME_MODE).toBe("source-only");
    expect(() => startGovernedBrowserRuntime()).toThrow("source-only");
  });
});

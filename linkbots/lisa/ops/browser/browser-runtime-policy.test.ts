import { describe, expect, it } from "vitest";
import {
  LISA_BROWSER_RUNTIME_CONTRACT,
  resolveLisaBrowserRuntimePolicy,
} from "./browser-runtime-policy.js";

describe("Lisa browser runtime contract", () => {
  it("is declarative, headless, and fail-closed by default", () => {
    const policy = resolveLisaBrowserRuntimePolicy({ stateDirectory: "/var/lib/lisa" });
    expect(policy).toMatchObject({
      contract: LISA_BROWSER_RUNTIME_CONTRACT,
      profile: "lisa-vps",
      mode: "source-only",
      headless: true,
      privateNetwork: "deny-by-default",
      redirects: "revalidate-every-hop",
      credentials: "never-model-visible",
      downloads: "isolated-never-open-or-execute",
      visualLogin: "temporary-operator-only",
      downloadPolicy: {
        directory: "/var/lib/lisa/downloads",
        openAfterDownload: false,
        executeAfterDownload: false,
      },
    });
  });

  it("accepts bounded operator limits without performing runtime work", () => {
    const policy = resolveLisaBrowserRuntimePolicy({
      stateDirectory: "/var/lib/lisa",
      limits: { maxConcurrentSessions: 1, maxMemoryMb: 512 },
    });
    expect(policy.limits).toMatchObject({ maxConcurrentSessions: 1, maxMemoryMb: 512 });
  });
});

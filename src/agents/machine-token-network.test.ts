import { describe, expect, it, vi } from "vitest";
import { resolvePinnedHostnameWithPolicy, type LookupFn } from "../infra/net/ssrf.js";
import {
  assertMachineTokenNetworkUrl,
  assertMachineTokenRequestBounds,
  buildMachineTokenSsrFPolicy,
  describeMachineTokenHttpFailure,
  MACHINE_TOKEN_MAX_REQUEST_BODY_BYTES,
  MACHINE_TOKEN_MAX_REQUEST_HEADER_BYTES,
  MACHINE_TOKEN_MAX_RESPONSE_BYTES,
  MACHINE_TOKEN_NETWORK_TIMEOUT_MS,
  machineTokenNetworkFetch,
  machineTokenNetworkFetchJson,
} from "./machine-token-network.js";

const { fetchWithSsrFGuardMock } = vi.hoisted(() => ({
  fetchWithSsrFGuardMock: vi.fn(),
}));

function lookupAddress(address: string): LookupFn {
  return (async () => [{ address, family: 4 }]) as unknown as LookupFn;
}

vi.mock("../infra/net/fetch-guard.js", () => ({
  fetchWithSsrFGuard: (...args: unknown[]) => fetchWithSsrFGuardMock(...args),
}));

/** Forever-streaming body: bounded readers must cancel after the byte cap. */
function createUnboundedBodyStream(): ReadableStream<Uint8Array> {
  const chunk = new Uint8Array(1024).fill(0x78); // 'x'
  return new ReadableStream({
    pull(controller) {
      controller.enqueue(chunk);
    },
  });
}

describe("machine-token-network", () => {
  it("documents injected fetchFn as a test seam that bypasses SSRF guard", async () => {
    const fetchFn = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const result = await machineTokenNetworkFetchJson({
      url: "https://paci.test/.well-known/oauth-authorization-server",
      fetchFn,
      label: "discovery",
    });
    expect(result.ok).toBe(true);
    expect(result.json).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchWithSsrFGuardMock).not.toHaveBeenCalled();
  });

  it("rejects HTTP non-loopback and production loopback targets", () => {
    expect(() =>
      assertMachineTokenNetworkUrl({
        url: "http://example.com/oauth/token",
        label: "token",
      }),
    ).toThrow(/HTTPS/u);
    expect(() =>
      assertMachineTokenNetworkUrl({
        url: "https://127.0.0.1/oauth/token",
        label: "token",
      }),
    ).toThrow(/loopback/u);
  });

  it("maps 429 and 5xx without embedding response bodies", () => {
    expect(describeMachineTokenHttpFailure(429, "token request")).toMatch(/429/u);
    expect(describeMachineTokenHttpFailure(503, "discovery")).toMatch(/503/u);
    expect(describeMachineTokenHttpFailure(401, "token request")).toMatch(/401/u);
  });

  it("rejects unsupported JSON content types through the fetchFn seam", async () => {
    await expect(
      machineTokenNetworkFetchJson({
        url: "https://paci.test/oauth/token",
        fetchFn: async () =>
          new Response("not-json", {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
        label: "token",
      }),
    ).rejects.toThrow(/content-type must be application\/json/u);
  });

  it("always exposes a release function for late-settlement safety", async () => {
    const { response, release } = await machineTokenNetworkFetch({
      url: "https://paci.test/oauth/token",
      fetchFn: async () => new Response("{}", { headers: { "content-type": "application/json" } }),
      label: "token",
    });
    expect(response.ok).toBe(true);
    await expect(release()).resolves.toBeUndefined();
    await expect(release()).resolves.toBeUndefined();
  });

  it("passes zero redirects and fixed deadline on the production SSRF auth path", async () => {
    fetchWithSsrFGuardMock.mockResolvedValueOnce({
      response: new Response(
        JSON.stringify({ token_endpoint: "https://paci.example/oauth/token" }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
      finalUrl: "https://paci.example/.well-known/oauth-authorization-server",
      release: async () => undefined,
    });

    const result = await machineTokenNetworkFetchJson({
      url: "https://paci.example/.well-known/oauth-authorization-server",
      label: "discovery",
    });

    expect(result.ok).toBe(true);
    expect(fetchWithSsrFGuardMock).toHaveBeenCalledTimes(1);
    expect(fetchWithSsrFGuardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        maxRedirects: 0,
        timeoutMs: MACHINE_TOKEN_NETWORK_TIMEOUT_MS,
        requireHttps: true,
        auditContext: "machine-token",
      }),
    );
  });

  it("bounds non-2xx response body reads without unbounded arrayBuffer", async () => {
    let arrayBufferCalls = 0;
    const response = new Response(createUnboundedBodyStream(), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
    const originalArrayBuffer = response.arrayBuffer.bind(response);
    response.arrayBuffer = async () => {
      arrayBufferCalls += 1;
      return originalArrayBuffer();
    };

    const result = await machineTokenNetworkFetchJson({
      url: "https://paci.test/oauth/token",
      fetchFn: async () => response,
      label: "token",
    });

    expect(result).toEqual({ status: 500, ok: false, json: undefined });
    expect(arrayBufferCalls).toBe(0);
    expect(MACHINE_TOKEN_MAX_RESPONSE_BYTES).toBe(64 * 1024);
  });

  it("rejects oversized outbound request headers and bodies", () => {
    expect(() =>
      assertMachineTokenRequestBounds({
        label: "token",
        init: {
          headers: {
            "x-pad": "y".repeat(MACHINE_TOKEN_MAX_REQUEST_HEADER_BYTES + 1),
          },
        },
      }),
    ).toThrow(/headers exceed size limit/u);

    expect(() =>
      assertMachineTokenRequestBounds({
        label: "token",
        init: {
          method: "POST",
          body: "z".repeat(MACHINE_TOKEN_MAX_REQUEST_BODY_BYTES + 1),
        },
      }),
    ).toThrow(/body exceeds size limit/u);
  });

  it("forces redirect:error on the injected auth test-seam fetch", async () => {
    const fetchFn = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    await machineTokenNetworkFetch({
      url: "https://paci.test/oauth/token",
      fetchFn,
      label: "token",
    });
    expect(fetchFn.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ redirect: "error" }));
  });

  describe("allowPrivateNetwork trusted-private issuer opt-in", () => {
    const tailnetIssuer = "https://linktrend-mini.tailf7e13a.ts.net:9443";
    const tailnetDiscovery = `${tailnetIssuer}/.well-known/oauth-authorization-server`;
    const tailnetPrivateIp = "100.64.1.10"; // CGNAT / Tailscale-class

    it("defaults to denying private resolution (stage PACI without opt-in)", async () => {
      expect(buildMachineTokenSsrFPolicy({ url: tailnetDiscovery })).toBeUndefined();
      await expect(
        resolvePinnedHostnameWithPolicy("linktrend-mini.tailf7e13a.ts.net", {
          lookupFn: lookupAddress(tailnetPrivateIp),
          policy: buildMachineTokenSsrFPolicy({ url: tailnetDiscovery }),
        }),
      ).rejects.toThrow(/resolves to private\/internal\/special-use/iu);
    });

    it("with allowPrivateNetwork pins exact HTTPS origin/hostname and allows private/CGNAT", async () => {
      const policy = buildMachineTokenSsrFPolicy({
        url: tailnetDiscovery,
        allowPrivateNetwork: true,
      });
      expect(policy).toEqual({
        allowedOrigins: ["https://linktrend-mini.tailf7e13a.ts.net:9443"],
        allowedHostnames: ["linktrend-mini.tailf7e13a.ts.net"],
      });
      // Do not set SsrFPolicy.allowPrivateNetwork — that would skip metadata/link-local checks.
      expect(policy).not.toHaveProperty("allowPrivateNetwork");

      const pinned = await resolvePinnedHostnameWithPolicy("linktrend-mini.tailf7e13a.ts.net", {
        lookupFn: lookupAddress(tailnetPrivateIp),
        policy,
      });
      expect(pinned.addresses).toEqual([tailnetPrivateIp]);
    });

    it("still blocks metadata and link-local under allowPrivateNetwork pinning", async () => {
      const policy = buildMachineTokenSsrFPolicy({
        url: tailnetDiscovery,
        allowPrivateNetwork: true,
      });
      await expect(
        resolvePinnedHostnameWithPolicy("linktrend-mini.tailf7e13a.ts.net", {
          lookupFn: lookupAddress("169.254.169.254"),
          policy,
        }),
      ).rejects.toThrow(/resolves to private\/internal\/special-use/iu);
      await expect(
        resolvePinnedHostnameWithPolicy("linktrend-mini.tailf7e13a.ts.net", {
          lookupFn: lookupAddress("169.254.1.1"),
          policy,
        }),
      ).rejects.toThrow(/resolves to private\/internal\/special-use/iu);
    });

    it("does not grant private fetch for a different origin even with opt-in", async () => {
      const policy = buildMachineTokenSsrFPolicy({
        url: tailnetDiscovery,
        allowPrivateNetwork: true,
      });
      // Cross-origin hostname is not in allowedHostnames and has no private allowance.
      await expect(
        resolvePinnedHostnameWithPolicy("other-issuer.example.com", {
          lookupFn: lookupAddress("10.0.0.9"),
          policy,
        }),
      ).rejects.toThrow(/private\/internal\/special-use/iu);
    });

    it("HTTP non-loopback still fails even when allowPrivateNetwork is true", () => {
      expect(() =>
        assertMachineTokenNetworkUrl({
          url: "http://linktrend-mini.tailf7e13a.ts.net:9443/oauth/token",
          allowPrivateNetwork: true,
          label: "token",
        }),
      ).toThrow(/HTTPS/u);
    });

    it("passes allowPrivateNetwork pinning into the production SSRF auth path", async () => {
      fetchWithSsrFGuardMock.mockResolvedValueOnce({
        response: new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
        finalUrl: tailnetDiscovery,
        release: async () => undefined,
      });

      await machineTokenNetworkFetchJson({
        url: tailnetDiscovery,
        allowPrivateNetwork: true,
        label: "discovery",
      });

      expect(fetchWithSsrFGuardMock).toHaveBeenCalledWith(
        expect.objectContaining({
          maxRedirects: 0,
          requireHttps: true,
          auditContext: "machine-token",
          policy: {
            allowedOrigins: ["https://linktrend-mini.tailf7e13a.ts.net:9443"],
            allowedHostnames: ["linktrend-mini.tailf7e13a.ts.net"],
          },
        }),
      );
    });

    it("keeps localTest broad private allowance separate from production opt-in", () => {
      expect(
        buildMachineTokenSsrFPolicy({
          url: "http://127.0.0.1:9443/.well-known/oauth-authorization-server",
          localTest: true,
        }),
      ).toEqual({ allowPrivateNetwork: true });
      expect(
        buildMachineTokenSsrFPolicy({
          url: tailnetDiscovery,
          localTest: true,
          allowPrivateNetwork: true,
        }),
      ).toEqual({ allowPrivateNetwork: true });
    });
  });
});

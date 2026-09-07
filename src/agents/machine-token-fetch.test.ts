import { afterEach, describe, expect, it, vi } from "vitest";
import { createPaciFakeEs256KeyPair } from "../../test/helpers/paci-fake/keys.js";
import { createPaciFakeServer } from "../../test/helpers/paci-fake/server.js";
import { withMachineTokenBearer } from "./machine-token-fetch.js";
import type { MachineTokenBinding, MachineTokenFetchFn } from "./machine-token-types.js";
import { clearMachineTokenCache } from "./machine-token.js";

const ISSUER = "https://paci.test";
const RESOURCE = "https://resource.test/mcp";
const CLIENT_ID = "skills-client";

function bearer(headers: HeadersInit | undefined): string | null {
  return new Headers(headers).get("authorization")?.replace(/^Bearer /u, "") ?? null;
}

function callHeaders(
  fetchFn: ReturnType<typeof vi.fn<MachineTokenFetchFn>>,
  index: number,
): HeadersInit {
  const call = fetchFn.mock.calls[index];
  const input = call?.[0];
  return input instanceof Request ? input.headers : (call?.[1]?.headers ?? {});
}

async function createBinding(): Promise<{
  binding: MachineTokenBinding;
  publicKeyPem: string;
}> {
  const keys = await createPaciFakeEs256KeyPair({ reuse: false });
  return {
    publicKeyPem: keys.publicKeyPem,
    binding: {
      bindingId: "binding-skills",
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientAssertionKeyPem: keys.privateKeyPem,
    },
  };
}

describe("withMachineTokenBearer", () => {
  afterEach(() => {
    clearMachineTokenCache();
  });

  it("injects Bearer only at the configured resource origin", async () => {
    const { binding, publicKeyPem } = await createBinding();
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: publicKeyPem,
    });
    const resourceFetch = vi.fn<MachineTokenFetchFn>(async () => new Response("ok"));
    const wrapped = withMachineTokenBearer({
      fetchFn: resourceFetch,
      authFetchFn: fake.fetchFn,
      binding,
      resourceUrl: RESOURCE,
    });

    await wrapped(RESOURCE, { headers: { "x-tenant": "skills" } });
    await wrapped("https://other.test/api");

    expect(resourceFetch).toHaveBeenCalledTimes(2);
    expect(bearer(callHeaders(resourceFetch, 0))).toMatch(
      /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u,
    );
    expect(bearer(callHeaders(resourceFetch, 1))).toBeNull();
    expect(fake.tokenRequestCount()).toBe(1);
  });

  it("does not use the injected resource fetchFn for discovery or mint", async () => {
    const { binding } = await createBinding();
    const resourceFetch = vi.fn<MachineTokenFetchFn>(async (input) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("paci.test") || url.includes("well-known") || url.includes("oauth")) {
        throw new Error("resource fetch must not handle auth traffic");
      }
      return new Response("ok");
    });
    const wrapped = withMachineTokenBearer({
      fetchFn: resourceFetch,
      // authFetchFn omitted → hardened auth network (not resource fetch)
      binding,
      resourceUrl: RESOURCE,
    });

    await expect(wrapped(RESOURCE)).rejects.toThrow(/Machine-token /u);
    expect(resourceFetch).not.toHaveBeenCalled();
  });

  it("reissues once on 401 and retries with the replacement token", async () => {
    const { binding, publicKeyPem } = await createBinding();
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: publicKeyPem,
    });
    const seenTokens: string[] = [];
    const resourceFetch = vi.fn<MachineTokenFetchFn>(async (input, init) => {
      const token = bearer(input instanceof Request ? input.headers : (init?.headers ?? {}));
      if (token) {
        seenTokens.push(token);
      }
      if (seenTokens.length === 1) {
        return new Response("unauthorized", { status: 401 });
      }
      return new Response("ok", { status: 200 });
    });
    const wrapped = withMachineTokenBearer({
      fetchFn: resourceFetch,
      authFetchFn: fake.fetchFn,
      binding,
      resourceUrl: RESOURCE,
    });

    await expect(wrapped(RESOURCE)).resolves.toMatchObject({ status: 200 });
    expect(resourceFetch).toHaveBeenCalledTimes(2);
    expect(seenTokens).toHaveLength(2);
    expect(seenTokens[0]).not.toBe(seenTokens[1]);
    expect(fake.tokenRequestCount()).toBe(2);
  });

  it("reissues once on 403 and does not retry endlessly", async () => {
    const { binding, publicKeyPem } = await createBinding();
    const fake = await createPaciFakeServer({
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
      clientPublicKeyPem: publicKeyPem,
    });
    const seenTokens: string[] = [];
    const resourceFetch = vi.fn<MachineTokenFetchFn>(async (input, init) => {
      const token = bearer(input instanceof Request ? input.headers : (init?.headers ?? {}));
      if (token) {
        seenTokens.push(token);
      }
      return new Response("forbidden", { status: 403 });
    });
    const wrapped = withMachineTokenBearer({
      fetchFn: resourceFetch,
      authFetchFn: fake.fetchFn,
      binding,
      resourceUrl: RESOURCE,
    });

    await expect(wrapped(RESOURCE)).resolves.toMatchObject({ status: 403 });
    expect(resourceFetch).toHaveBeenCalledTimes(2);
    expect(seenTokens).toHaveLength(2);
    expect(seenTokens[0]).not.toBe(seenTokens[1]);
    expect(fake.tokenRequestCount()).toBe(2);
  });
});

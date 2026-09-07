import { describe, expect, it } from "vitest";
import {
  assertMachineTokenDiscoveryJsonNoDuplicateKeys,
  assertMachineTokenIssuerUrl,
  buildMachineTokenDiscoveryUrl,
  discoverMachineTokenAuthorizationServer,
  validateMachineTokenAuthorizationServerMetadata,
} from "./machine-token-discovery.js";

const ISSUER = "https://paci.test";

function validMetadata(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    issuer: ISSUER,
    token_endpoint: `${ISSUER}/oauth/token`,
    jwks_uri: `${ISSUER}/.well-known/jwks.json`,
    introspection_endpoint: `${ISSUER}/oauth/introspect`,
    grant_types_supported: ["client_credentials"],
    token_endpoint_auth_methods_supported: ["private_key_jwt"],
    token_endpoint_auth_signing_alg_values_supported: ["ES256"],
    introspection_endpoint_auth_methods_supported: ["private_key_jwt"],
    response_types_supported: [],
    scopes_supported: ["lbrain", "lskills", "linkplatform"],
    ...overrides,
  };
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("machine-token discovery issuer URL", () => {
  it("builds discovery URL and rejects trailing-slash or path issuers", () => {
    expect(buildMachineTokenDiscoveryUrl(ISSUER)).toBe(
      `${ISSUER}/.well-known/oauth-authorization-server`,
    );
    expect(() => assertMachineTokenIssuerUrl(`${ISSUER}/`)).toThrow(/trailing slash/u);
    expect(() => assertMachineTokenIssuerUrl(`${ISSUER}/tenant`)).toThrow(/path/u);
  });
});

describe("machine-token frozen RFC 8414 metadata (Codex nine + adversarial)", () => {
  it("accepts Platform-parity Phase-1 metadata exactly", () => {
    const metadata = validateMachineTokenAuthorizationServerMetadata({
      issuerUrl: ISSUER,
      metadata: validMetadata(),
    });
    expect(metadata.issuer).toBe(ISSUER);
    expect(metadata.grant_types_supported).toEqual(["client_credentials"]);
    expect(metadata.token_endpoint_auth_methods_supported).toEqual(["private_key_jwt"]);
    expect(metadata.token_endpoint_auth_signing_alg_values_supported).toEqual(["ES256"]);
    expect(metadata.introspection_endpoint_auth_methods_supported).toEqual(["private_key_jwt"]);
    expect(metadata.response_types_supported).toEqual([]);
    expect(metadata.jwks_uri).toBe(`${ISSUER}/.well-known/jwks.json`);
    expect(metadata.introspection_endpoint).toBe(`${ISSUER}/oauth/introspect`);
  });

  // Codex case 1 — configured issuer equality with no trailing slash
  it("rejects issuer mismatch and reported trailing-slash issuer (exact match)", () => {
    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({ issuer: "https://other.test" }),
      }),
    ).toThrow(/does not match configured issuer/u);

    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({ issuer: `${ISSUER}/` }),
      }),
    ).toThrow(/does not match configured issuer/u);
  });

  // Codex case 2 — required HTTPS endpoints (localTest loopback HTTP gated elsewhere)
  it("rejects HTTP endpoints outside explicit local-test loopback", () => {
    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({
          token_endpoint: "http://paci.test/oauth/token",
        }),
      }),
    ).toThrow(/HTTPS/u);

    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: "http://127.0.0.1:9",
        localTest: true,
        metadata: validMetadata({
          issuer: "http://127.0.0.1:9",
          token_endpoint: "http://127.0.0.1:9/oauth/token",
          jwks_uri: "http://127.0.0.1:9/.well-known/jwks.json",
          introspection_endpoint: "http://127.0.0.1:9/oauth/introspect",
        }),
      }),
    ).not.toThrow();
  });

  // Codex case 3 — omit authorization_endpoint; reject null or any value
  it("rejects authorization_endpoint when present as null, string, or empty", () => {
    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({ authorization_endpoint: null }),
      }),
    ).toThrow(/omit authorization_endpoint/u);

    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({ authorization_endpoint: `${ISSUER}/authorize` }),
      }),
    ).toThrow(/omit authorization_endpoint/u);

    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({ authorization_endpoint: "" }),
      }),
    ).toThrow(/omit authorization_endpoint/u);
  });

  // Codex case 4 — required JWKS, introspection, token endpoints (same-origin)
  it("requires jwks_uri, introspection_endpoint, and token_endpoint", () => {
    const withoutJwks = validMetadata();
    delete withoutJwks.jwks_uri;
    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: withoutJwks,
      }),
    ).toThrow(/missing jwks_uri/u);

    const withoutIntrospect = validMetadata();
    delete withoutIntrospect.introspection_endpoint;
    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: withoutIntrospect,
      }),
    ).toThrow(/missing introspection_endpoint/u);

    const withoutToken = validMetadata();
    delete withoutToken.token_endpoint;
    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: withoutToken,
      }),
    ).toThrow(/missing token_endpoint/u);
  });

  // Codex case 5 — exact Phase-1 grant/auth/signing arrays
  it("requires exact grant_types, token auth methods, and ES256 signing algs", () => {
    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({
          grant_types_supported: ["client_credentials", "authorization_code"],
        }),
      }),
    ).toThrow(/grant_types_supported must be exactly/u);

    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({
          grant_types_supported: ["authorization_code"],
        }),
      }),
    ).toThrow(/grant_types_supported must be exactly/u);

    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({
          token_endpoint_auth_methods_supported: ["private_key_jwt", "client_secret_basic"],
        }),
      }),
    ).toThrow(/token_endpoint_auth_methods_supported must be exactly/u);

    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({
          token_endpoint_auth_methods_supported: ["client_secret_post"],
        }),
      }),
    ).toThrow(/token_endpoint_auth_methods_supported must be exactly/u);

    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({
          token_endpoint_auth_signing_alg_values_supported: ["RS256"],
        }),
      }),
    ).toThrow(/token_endpoint_auth_signing_alg_values_supported must be exactly/u);

    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({
          token_endpoint_auth_signing_alg_values_supported: ["ES256", "RS256"],
        }),
      }),
    ).toThrow(/token_endpoint_auth_signing_alg_values_supported must be exactly/u);

    const withoutSigning = validMetadata();
    delete withoutSigning.token_endpoint_auth_signing_alg_values_supported;
    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: withoutSigning,
      }),
    ).toThrow(/token_endpoint_auth_signing_alg_values_supported must be an array/u);
  });

  // Codex case 6 — response_types_supported exactly []
  it("requires response_types_supported present as empty array", () => {
    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({ response_types_supported: ["code"] }),
      }),
    ).toThrow(/response_types_supported must be exactly/u);

    const withoutResponseTypes = validMetadata();
    delete withoutResponseTypes.response_types_supported;
    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: withoutResponseTypes,
      }),
    ).toThrow(/response_types_supported must be an array/u);
  });

  // Codex case 7 — introspection_endpoint_auth_methods_supported exactly private_key_jwt
  it("requires introspection_endpoint_auth_methods_supported exactly private_key_jwt", () => {
    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({
          introspection_endpoint_auth_methods_supported: ["client_secret_basic"],
        }),
      }),
    ).toThrow(/introspection_endpoint_auth_methods_supported must be exactly/u);

    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({
          introspection_endpoint_auth_methods_supported: ["private_key_jwt", "none"],
        }),
      }),
    ).toThrow(/introspection_endpoint_auth_methods_supported must be exactly/u);

    const withoutIntrospectionAuth = validMetadata();
    delete withoutIntrospectionAuth.introspection_endpoint_auth_methods_supported;
    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: withoutIntrospectionAuth,
      }),
    ).toThrow(/introspection_endpoint_auth_methods_supported must be an array/u);
  });

  // Codex case 8 — correct element types
  it("rejects malformed array elements that are not strings", () => {
    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({
          grant_types_supported: ["client_credentials", 1],
        }),
      }),
    ).toThrow(/grant_types_supported elements must be strings/u);

    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({
          token_endpoint_auth_methods_supported: [{ method: "private_key_jwt" }],
        }),
      }),
    ).toThrow(/token_endpoint_auth_methods_supported elements must be strings/u);

    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({
          token_endpoint_auth_signing_alg_values_supported: [null],
        }),
      }),
    ).toThrow(/token_endpoint_auth_signing_alg_values_supported elements must be strings/u);

    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({
          response_types_supported: [false],
        }),
      }),
    ).toThrow(/response_types_supported elements must be strings/u);

    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({
          scopes_supported: ["lbrain", 42],
        }),
      }),
    ).toThrow(/scopes_supported elements must be strings/u);
  });

  // Codex case 9 — reject extra unsupported grant/auth/algorithm values
  it("rejects extra unsupported grant, auth, and algorithm values", () => {
    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({
          grant_types_supported: ["client_credentials", "refresh_token"],
        }),
      }),
    ).toThrow(/grant_types_supported must be exactly/u);

    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({
          token_endpoint_auth_methods_supported: ["private_key_jwt", "none"],
        }),
      }),
    ).toThrow(/token_endpoint_auth_methods_supported must be exactly/u);

    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({
          token_endpoint_auth_signing_alg_values_supported: ["ES256", "ES384"],
        }),
      }),
    ).toThrow(/token_endpoint_auth_signing_alg_values_supported must be exactly/u);
  });

  it("rejects wrong-origin endpoints", () => {
    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({
          token_endpoint: "https://other.test/oauth/token",
        }),
      }),
    ).toThrow(/share the issuer origin/u);

    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({
          jwks_uri: "https://evil.test/.well-known/jwks.json",
        }),
      }),
    ).toThrow(/share the issuer origin/u);

    expect(() =>
      validateMachineTokenAuthorizationServerMetadata({
        issuerUrl: ISSUER,
        metadata: validMetadata({
          introspection_endpoint: "https://evil.test/oauth/introspect",
        }),
      }),
    ).toThrow(/share the issuer origin/u);
  });

  it("rejects duplicate top-level metadata fields", () => {
    const duplicateIssuer = `{"issuer":"${ISSUER}","issuer":"https://evil.test","token_endpoint":"${ISSUER}/oauth/token"}`;
    expect(() => assertMachineTokenDiscoveryJsonNoDuplicateKeys(duplicateIssuer)).toThrow(
      /duplicate field "issuer"/u,
    );

    const duplicateGrant = `{"issuer":"${ISSUER}","grant_types_supported":["client_credentials"],"grant_types_supported":["authorization_code"]}`;
    expect(() => assertMachineTokenDiscoveryJsonNoDuplicateKeys(duplicateGrant)).toThrow(
      /duplicate field "grant_types_supported"/u,
    );

    expect(() =>
      assertMachineTokenDiscoveryJsonNoDuplicateKeys(JSON.stringify(validMetadata())),
    ).not.toThrow();
  });

  it("rejects discovery redirects via injected fetch", async () => {
    await expect(
      discoverMachineTokenAuthorizationServer({
        issuerUrl: ISSUER,
        fetchFn: async () =>
          new Response(null, {
            status: 302,
            headers: { location: "https://evil.test/metadata" },
          }),
      }),
    ).rejects.toThrow(/rejects HTTP redirects/u);

    await expect(
      discoverMachineTokenAuthorizationServer({
        issuerUrl: ISSUER,
        fetchFn: async () => {
          const response = jsonResponse(validMetadata());
          Object.defineProperty(response, "redirected", { value: true });
          return response;
        },
      }),
    ).rejects.toThrow(/rejects HTTP redirects/u);
  });

  it("bounds non-2xx discovery body reads without unbounded arrayBuffer", async () => {
    const chunk = new Uint8Array(1024).fill(0x78);
    const unbounded = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(chunk);
      },
    });
    let arrayBufferCalls = 0;
    const response = new Response(unbounded, {
      status: 500,
      headers: { "content-type": "application/json" },
    });
    const originalArrayBuffer = response.arrayBuffer.bind(response);
    response.arrayBuffer = async () => {
      arrayBufferCalls += 1;
      return originalArrayBuffer();
    };

    await expect(
      discoverMachineTokenAuthorizationServer({
        issuerUrl: ISSUER,
        fetchFn: async () => response,
      }),
    ).rejects.toThrow(/discovery failed with HTTP 500/u);
    expect(arrayBufferCalls).toBe(0);
  });

  it("discovers and validates Platform-parity metadata over fetch", async () => {
    const metadata = await discoverMachineTokenAuthorizationServer({
      issuerUrl: ISSUER,
      fetchFn: async () => jsonResponse(validMetadata()),
    });
    expect(metadata.token_endpoint).toBe(`${ISSUER}/oauth/token`);
    expect(metadata.grant_types_supported).toEqual(["client_credentials"]);
  });

  it("rejects discovery bodies with duplicate conflicting fields", async () => {
    const body = [
      "{",
      `"issuer":"${ISSUER}",`,
      `"issuer":"https://evil.test",`,
      `"token_endpoint":"${ISSUER}/oauth/token",`,
      `"jwks_uri":"${ISSUER}/.well-known/jwks.json",`,
      `"introspection_endpoint":"${ISSUER}/oauth/introspect",`,
      `"grant_types_supported":["client_credentials"],`,
      `"token_endpoint_auth_methods_supported":["private_key_jwt"],`,
      `"token_endpoint_auth_signing_alg_values_supported":["ES256"],`,
      `"introspection_endpoint_auth_methods_supported":["private_key_jwt"],`,
      `"response_types_supported":[]`,
      "}",
    ].join("");

    await expect(
      discoverMachineTokenAuthorizationServer({
        issuerUrl: ISSUER,
        fetchFn: async () => jsonResponse(body),
      }),
    ).rejects.toThrow(/duplicate field "issuer"/u);
  });
});

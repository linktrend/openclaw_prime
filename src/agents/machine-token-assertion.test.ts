import { describe, expect, it } from "vitest";
import { createPaciFakeEs256KeyPair } from "../../test/helpers/paci-fake/keys.js";
import {
  createMachineTokenClientAssertion,
  MACHINE_TOKEN_ASSERTION_MAX_LIFETIME_SECONDS,
} from "./machine-token-assertion.js";

describe("machine-token client assertion", () => {
  it("signs ES256 private_key_jwt with iss=sub, aud=token_endpoint, bounded exp, and jti", async () => {
    const keys = await createPaciFakeEs256KeyPair({ reuse: false });
    const nowMs = 1_700_000_000_000;
    const tokenEndpoint = "https://paci.test/oauth/token";
    const first = await createMachineTokenClientAssertion({
      clientId: "brain-client",
      tokenEndpoint,
      clientAssertionKeyPem: keys.privateKeyPem,
      now: () => nowMs,
    });
    const second = await createMachineTokenClientAssertion({
      clientId: "brain-client",
      tokenEndpoint,
      clientAssertionKeyPem: keys.privateKeyPem,
      now: () => nowMs,
    });

    expect(first.jti).not.toBe(second.jti);
    expect(first.iat).toBe(Math.floor(nowMs / 1000));
    expect(first.exp).toBe(first.iat + MACHINE_TOKEN_ASSERTION_MAX_LIFETIME_SECONDS);
    expect(first.assertion.split(".")).toHaveLength(3);
    expect(first.assertion).not.toContain(keys.privateKeyPem);

    const payload = JSON.parse(
      Buffer.from(first.assertion.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    expect(payload).toMatchObject({
      iss: "brain-client",
      sub: "brain-client",
      aud: tokenEndpoint,
      jti: first.jti,
      iat: first.iat,
      exp: first.exp,
    });
  });

  it("rejects invalid PEM without echoing key material", async () => {
    const bogusPem = "-----BEGIN PRIVATE KEY-----\nnot-a-key\n-----END PRIVATE KEY-----";
    await expect(
      createMachineTokenClientAssertion({
        clientId: "brain-client",
        tokenEndpoint: "https://paci.test/oauth/token",
        clientAssertionKeyPem: bogusPem,
      }),
    ).rejects.toThrow(/Failed to import machine-token client assertion key/u);
    try {
      await createMachineTokenClientAssertion({
        clientId: "brain-client",
        tokenEndpoint: "https://paci.test/oauth/token",
        clientAssertionKeyPem: bogusPem,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(bogusPem);
      expect((error as Error).message).not.toContain("not-a-key");
    }
  });
});

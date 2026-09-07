/**
 * ES256 private_key_jwt client assertions for machine-token minting.
 *
 * Contract: iss=sub=clientId; aud=exact token_endpoint; iat=now; exp<=now+5m;
 * jti=uuid. Errors never include PEM, assertion, or access-token material.
 */
import { randomUUID } from "node:crypto";
import { importPKCS8, SignJWT } from "jose";

/** Maximum client-assertion lifetime (RFC 7523 guidance: short-lived). */
export const MACHINE_TOKEN_ASSERTION_MAX_LIFETIME_SECONDS = 5 * 60;

export type CreateMachineTokenClientAssertionParams = {
  clientId: string;
  tokenEndpoint: string;
  clientAssertionKeyPem: string;
  /** Injected clock (ms epoch). Defaults to Date.now. */
  now?: () => number;
};

export type MachineTokenClientAssertion = {
  assertion: string;
  jti: string;
  iat: number;
  exp: number;
};

function assertionError(message: string, cause?: unknown): Error {
  return new Error(message, cause !== undefined ? { cause } : undefined);
}

/**
 * Build a one-shot ES256 client assertion for the token endpoint.
 *
 * @throws when the PEM cannot be imported or signing fails (redacted message)
 */
export async function createMachineTokenClientAssertion(
  params: CreateMachineTokenClientAssertionParams,
): Promise<MachineTokenClientAssertion> {
  const nowMs = (params.now ?? Date.now)();
  const iat = Math.floor(nowMs / 1000);
  const exp = iat + MACHINE_TOKEN_ASSERTION_MAX_LIFETIME_SECONDS;
  const jti = randomUUID();

  let privateKey;
  try {
    privateKey = await importPKCS8(params.clientAssertionKeyPem, "ES256");
  } catch (cause) {
    throw assertionError("Failed to import machine-token client assertion key", cause);
  }

  try {
    const assertion = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer(params.clientId)
      .setSubject(params.clientId)
      .setAudience(params.tokenEndpoint)
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .setJti(jti)
      .sign(privateKey);
    return { assertion, jti, iat, exp };
  } catch (cause) {
    throw assertionError("Failed to sign machine-token client assertion", cause);
  }
}

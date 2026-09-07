/**
 * TEST ONLY — deterministic ES256 key material for fake PACI issuers/clients.
 *
 * Never use these keys outside tests. Never copy into production config,
 * fixtures shipped as live credentials, or operator docs with live paths.
 */
import { exportJWK, exportPKCS8, exportSPKI, generateKeyPair, type JWK } from "jose";
import { PACI_ALG } from "./constants.js";

export type PaciFakeEs256KeyPair = {
  /** PKCS#8 PEM private key (TEST ONLY). */
  privateKeyPem: string;
  /** SPKI PEM public key (TEST ONLY). */
  publicKeyPem: string;
  /** JWK public key for JWKS responses (TEST ONLY). */
  publicJwk: JWK;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  kid: string;
};

let cachedPair: Promise<PaciFakeEs256KeyPair> | undefined;

/**
 * Generate (or reuse) a process-local TEST ONLY ES256 keypair for fake PACI.
 */
export async function createPaciFakeEs256KeyPair(
  options: { kid?: string; reuse?: boolean } = {},
): Promise<PaciFakeEs256KeyPair> {
  const reuse = options.reuse !== false;
  if (reuse && cachedPair) {
    const pair = await cachedPair;
    if (!options.kid || options.kid === pair.kid) {
      return pair;
    }
  }

  const create = async (): Promise<PaciFakeEs256KeyPair> => {
    // extractable: required so tests can export PEM/JWK (TEST ONLY).
    const { privateKey, publicKey } = await generateKeyPair(PACI_ALG, {
      extractable: true,
    });
    const privateKeyPem = await exportPKCS8(privateKey);
    const publicKeyPem = await exportSPKI(publicKey);
    const publicJwk = await exportJWK(publicKey);
    const kid = options.kid ?? "paci-fake-test-only-es256";
    return {
      privateKeyPem,
      publicKeyPem,
      publicJwk: {
        ...publicJwk,
        kid,
        alg: PACI_ALG,
        use: "sig",
        kty: "EC",
        crv: "P-256",
      },
      privateKey,
      publicKey,
      kid,
    };
  };

  const pairPromise = create();
  if (reuse) {
    cachedPair = pairPromise;
  }
  return await pairPromise;
}

/** Drop the cached TEST ONLY keypair so the next call regenerates. */
export function resetPaciFakeEs256KeyPairCache(): void {
  cachedPair = undefined;
}

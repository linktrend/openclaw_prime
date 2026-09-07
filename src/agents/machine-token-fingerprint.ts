/**
 * Immutable binding fingerprints for machine-token cache / single-flight keys.
 *
 * Fingerprints cover issuer, discovery/token endpoint identity, client ID, key
 * reference (or PEM material hash), audience, service, operations/scopes, and
 * environment — never access tokens, assertions, or raw private keys in logs.
 */
import { createHash } from "node:crypto";
import { buildMachineTokenDiscoveryUrl } from "./machine-token-discovery.js";
import type { MachineTokenBinding, MachineTokenKeyRefIdentity } from "./machine-token-types.js";

function sha256Hex(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (let index = 0; index < parts.length; index += 1) {
    if (index > 0) {
      hash.update("\0");
    }
    hash.update(parts[index] ?? "", "utf8");
  }
  return hash.digest("hex");
}

/**
 * Hash SecretRef identity for cache keys without exposing secret values.
 */
export function fingerprintMachineTokenKeyRef(ref: MachineTokenKeyRefIdentity): string {
  return sha256Hex(["keyref", ref.source, ref.provider, ref.id]);
}

/**
 * Hash resolved PEM bytes for cache keys only. Never log the PEM or this
 * intermediate input; the hex digest is safe to use as a Map key.
 */
export function fingerprintMachineTokenPemMaterial(pem: string): string {
  return sha256Hex(["pem", pem]);
}

function normalizeScopeList(binding: MachineTokenBinding): string {
  const values = new Set<string>();
  if (binding.scope) {
    for (const part of binding.scope.split(/\s+/u)) {
      const trimmed = part.trim();
      if (trimmed) {
        values.add(trimmed);
      }
    }
  }
  for (const list of [binding.operations, binding.scopes]) {
    if (!list) {
      continue;
    }
    for (const entry of list) {
      const trimmed = entry.trim();
      if (trimmed) {
        values.add(trimmed);
      }
    }
  }
  return [...values].toSorted().join(" ");
}

function resolveDiscoveryUrl(binding: MachineTokenBinding): string {
  if (binding.discoveryUrl) {
    return binding.discoveryUrl;
  }
  return buildMachineTokenDiscoveryUrl(binding.issuerUrl, binding.localTest);
}

/**
 * Build the immutable binding fingerprint used as cache / single-flight key.
 *
 * Operator `bindingId` labels are intentionally excluded so two issuers that
 * share a label never collide, and so SecretRef/scope/endpoint rotation
 * invalidates only the exact prior fingerprint.
 */
export function buildMachineTokenBindingFingerprint(binding: MachineTokenBinding): string {
  const keyFingerprint =
    binding.keyRefFingerprint ?? fingerprintMachineTokenPemMaterial(binding.clientAssertionKeyPem);
  return sha256Hex([
    "machine-token-binding-v1",
    binding.issuerUrl,
    resolveDiscoveryUrl(binding),
    binding.tokenEndpoint ?? "",
    binding.clientId,
    keyFingerprint,
    binding.audience ?? "",
    binding.service ?? "",
    normalizeScopeList(binding),
    binding.environment ?? "",
    binding.localTest === true ? "local-test" : "prod",
    binding.allowPrivateNetwork === true ? "allow-private" : "deny-private",
  ]);
}

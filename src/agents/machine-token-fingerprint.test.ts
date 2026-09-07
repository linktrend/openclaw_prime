import { describe, expect, it } from "vitest";
import {
  buildMachineTokenBindingFingerprint,
  fingerprintMachineTokenKeyRef,
  fingerprintMachineTokenPemMaterial,
} from "./machine-token-fingerprint.js";
import type { MachineTokenBinding } from "./machine-token-types.js";

const PEM_A = `-----BEGIN PRIVATE KEY-----
A
-----END PRIVATE KEY-----`;
const PEM_B = `-----BEGIN PRIVATE KEY-----
B
-----END PRIVATE KEY-----`;

function baseBinding(overrides: Partial<MachineTokenBinding> = {}): MachineTokenBinding {
  return {
    bindingId: "label",
    issuerUrl: "https://paci.test",
    clientId: "client",
    clientAssertionKeyPem: PEM_A,
    ...overrides,
  };
}

describe("machine-token-fingerprint", () => {
  it("hashes SecretRef identity without embedding secret values", () => {
    const fp = fingerprintMachineTokenKeyRef({
      source: "env",
      provider: "default",
      id: "LINKTREND_PACI_KEY",
    });
    expect(fp).toMatch(/^[a-f0-9]{64}$/u);
    expect(fp).not.toContain("LINKTREND");
  });

  it("differs when issuer, client, key, scope, service, or environment change", () => {
    const base = buildMachineTokenBindingFingerprint(baseBinding());
    expect(
      buildMachineTokenBindingFingerprint(baseBinding({ issuerUrl: "https://other.test" })),
    ).not.toBe(base);
    expect(buildMachineTokenBindingFingerprint(baseBinding({ clientId: "other" }))).not.toBe(base);
    expect(
      buildMachineTokenBindingFingerprint(baseBinding({ clientAssertionKeyPem: PEM_B })),
    ).not.toBe(base);
    expect(buildMachineTokenBindingFingerprint(baseBinding({ scope: "a b" }))).not.toBe(base);
    expect(buildMachineTokenBindingFingerprint(baseBinding({ service: "brain" }))).not.toBe(base);
    expect(buildMachineTokenBindingFingerprint(baseBinding({ environment: "prod" }))).not.toBe(
      base,
    );
    expect(
      buildMachineTokenBindingFingerprint(
        baseBinding({
          keyRefFingerprint: fingerprintMachineTokenKeyRef({
            source: "env",
            provider: "default",
            id: "A",
          }),
        }),
      ),
    ).not.toBe(base);
  });

  it("ignores operator bindingId label for fingerprint equality", () => {
    const a = buildMachineTokenBindingFingerprint(baseBinding({ bindingId: "a" }));
    const b = buildMachineTokenBindingFingerprint(baseBinding({ bindingId: "b" }));
    expect(a).toBe(b);
  });

  it("changes fingerprint when allowPrivateNetwork opt-in flips", () => {
    const denied = buildMachineTokenBindingFingerprint(baseBinding());
    const allowed = buildMachineTokenBindingFingerprint(baseBinding({ allowPrivateNetwork: true }));
    expect(allowed).not.toBe(denied);
    expect(buildMachineTokenBindingFingerprint(baseBinding({ allowPrivateNetwork: false }))).toBe(
      denied,
    );
  });

  it("prefers keyRefFingerprint over PEM material hash", () => {
    const keyRef = fingerprintMachineTokenKeyRef({
      source: "file",
      provider: "vault",
      id: "/paci/key",
    });
    const withRef = buildMachineTokenBindingFingerprint(
      baseBinding({ keyRefFingerprint: keyRef, clientAssertionKeyPem: PEM_A }),
    );
    const withOtherPem = buildMachineTokenBindingFingerprint(
      baseBinding({ keyRefFingerprint: keyRef, clientAssertionKeyPem: PEM_B }),
    );
    expect(withRef).toBe(withOtherPem);
    expect(fingerprintMachineTokenPemMaterial(PEM_A)).not.toBe(
      fingerprintMachineTokenPemMaterial(PEM_B),
    );
  });
});

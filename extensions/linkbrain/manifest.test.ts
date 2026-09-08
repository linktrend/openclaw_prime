import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_LINKBRAIN_CONFIG, parseLinkbrainConfig } from "./src/config.js";

const root = path.dirname(fileURLToPath(import.meta.url));

describe("linkbrain manifest/config", () => {
  it("declares default-disabled private plugin metadata", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, "openclaw.plugin.json"), "utf8"),
    ) as {
      id: string;
      enabledByDefault: boolean;
      activation: { onStartup: boolean };
      contracts: { tools: string[] };
      toolMetadata: Record<string, { optional?: boolean }>;
      configSchema: { properties: Record<string, unknown> };
    };
    expect(manifest.id).toBe("linkbrain");
    expect(manifest.enabledByDefault).toBe(false);
    expect(manifest.activation.onStartup).toBe(true);
    expect(manifest.contracts.tools).toEqual(["linkbrain_read", "linkbrain_write"]);
    expect(manifest.toolMetadata.linkbrain_write).toEqual({ optional: true });
    expect(manifest.configSchema.properties).toMatchObject({
      mcpRead: expect.any(Object),
      captureEnqueue: expect.any(Object),
      captureDrain: expect.any(Object),
      coordinationWrites: expect.any(Object),
      transportMode: expect.any(Object),
      mcpServerName: expect.any(Object),
      allowProductionLoopbackHttp: expect.any(Object),
      redactionPolicyVersion: expect.any(Object),
      batchMaxEvents: expect.any(Object),
      batchMaxBytes: expect.any(Object),
      outboxMaxEntries: expect.any(Object),
    });
  });

  it("package.json points at the local entry and stays private", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
      name: string;
      private: boolean;
      openclaw: { extensions: string[] };
    };
    expect(pkg.name).toBe("@openclaw/linkbrain");
    expect(pkg.private).toBe(true);
    expect(pkg.openclaw.extensions).toEqual(["./index.ts"]);
  });

  it("parses independent Brain flags and SecretRef credential", () => {
    const config = parseLinkbrainConfig({
      mcpRead: true,
      captureEnqueue: true,
      captureDrain: false,
      coordinationWrites: true,
      ingestionCredential: {
        source: "env",
        provider: "default",
        id: "LINKTREND_BRAIN_TEST_INGESTION_TOKEN",
      },
      redactionPolicyVersion: "brain.redaction.v0",
      batchMaxEvents: 8,
      environment: "stage",
    });
    expect(config.mcpRead).toBe(true);
    expect(config.captureEnqueue).toBe(true);
    expect(config.captureDrain).toBe(false);
    expect(config.coordinationWrites).toBe(true);
    expect(config.ingestionCredential).toEqual({
      source: "env",
      provider: "default",
      id: "LINKTREND_BRAIN_TEST_INGESTION_TOKEN",
    });
    expect(config.batchMaxEvents).toBe(8);
    expect(config.environment).toBe("stage");
  });

  it("defaults all write flags off and transportMode disabled", () => {
    expect(parseLinkbrainConfig({})).toMatchObject({
      mcpRead: false,
      captureEnqueue: false,
      captureDrain: false,
      coordinationWrites: false,
      transportMode: "disabled",
      mcpServerName: "linkbrain",
      redactionPolicyVersion: DEFAULT_LINKBRAIN_CONFIG.redactionPolicyVersion,
    });
    expect(parseLinkbrainConfig({}).allowProductionLoopbackHttp).toBeUndefined();
  });

  it("parses the explicit production loopback flag without enabling it by default", () => {
    expect(parseLinkbrainConfig({ allowProductionLoopbackHttp: true })).toMatchObject({
      allowProductionLoopbackHttp: true,
    });
    expect(parseLinkbrainConfig({ allowProductionLoopbackHttp: false })).not.toHaveProperty(
      "allowProductionLoopbackHttp",
    );
  });

  it("rejects malformed SecretRef credentials", () => {
    expect(() =>
      parseLinkbrainConfig({
        ingestionCredential: { source: "env", provider: "default" },
      }),
    ).toThrow(/SecretRef/);
  });

  it("parses optional machineToken with SecretRef assertion key", () => {
    const config = parseLinkbrainConfig({
      machineToken: {
        bindingId: "linkbrain-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "brain-client",
        scope: "lbrain",
        clientAssertionKeyRef: {
          source: "env",
          provider: "default",
          id: "LINKTREND_BRAIN_ASSERTION_PEM",
        },
      },
    });
    expect(config.machineToken).toEqual({
      bindingId: "linkbrain-stage",
      issuerUrl: "https://issuer.example.test",
      clientId: "brain-client",
      scope: "lbrain",
      clientAssertionKeyRef: {
        source: "env",
        provider: "default",
        id: "LINKTREND_BRAIN_ASSERTION_PEM",
      },
    });
    expect(parseLinkbrainConfig({}).machineToken).toBeUndefined();
  });

  it("rejects literal string clientAssertionKeyRef (SecretRef-only)", () => {
    expect(() =>
      parseLinkbrainConfig({
        machineToken: {
          bindingId: "linkbrain-stage",
          issuerUrl: "https://issuer.example.test",
          clientId: "brain-client",
          clientAssertionKeyRef: "literal-pem",
        },
      }),
    ).toThrow(/SecretRef object/);
  });

  it("parses allowPrivateNetwork opt-in for trusted-private HTTPS issuers", () => {
    const config = parseLinkbrainConfig({
      environment: "stage",
      machineToken: {
        bindingId: "linkbrain-stage",
        issuerUrl: "https://linktrend-mini.tailf7e13a.ts.net:9443",
        clientId: "brain-client",
        allowPrivateNetwork: true,
        clientAssertionKeyRef: {
          source: "env",
          provider: "default",
          id: "LINKTREND_BRAIN_ASSERTION_PEM",
        },
      },
    });
    expect(config.machineToken?.allowPrivateNetwork).toBe(true);
    expect(
      parseLinkbrainConfig({
        environment: "stage",
        machineToken: {
          bindingId: "linkbrain-stage",
          issuerUrl: "https://linktrend-mini.tailf7e13a.ts.net:9443",
          clientId: "brain-client",
          clientAssertionKeyRef: {
            source: "env",
            provider: "default",
            id: "LINKTREND_BRAIN_ASSERTION_PEM",
          },
        },
      }).machineToken?.allowPrivateNetwork,
    ).toBeUndefined();
  });

  it("rejects allowPrivateNetwork with non-boolean values", () => {
    expect(() =>
      parseLinkbrainConfig({
        environment: "stage",
        machineToken: {
          bindingId: "linkbrain-stage",
          issuerUrl: "https://linktrend-mini.tailf7e13a.ts.net:9443",
          clientId: "brain-client",
          allowPrivateNetwork: "yes",
          clientAssertionKeyRef: {
            source: "env",
            provider: "default",
            id: "LINKTREND_BRAIN_ASSERTION_PEM",
          },
        },
      }),
    ).toThrow(/allowPrivateNetwork/);
  });

  it("schema marks clientAssertionKeyRef as secretRef only", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, "openclaw.plugin.json"), "utf8"),
    ) as {
      configSchema: {
        $defs: {
          machineToken: { properties: { clientAssertionKeyRef: { $ref: string } } };
        };
      };
      configContracts: { secretInputs: { paths: Array<{ path: string }> } };
    };
    expect(manifest.configSchema.$defs.machineToken.properties.clientAssertionKeyRef.$ref).toBe(
      "#/$defs/secretRef",
    );
    // Must not be a string-materialized secretInput — host resolves at acquire only.
    expect(manifest.configContracts.secretInputs.paths.map((entry) => entry.path)).toEqual([
      "ingestionCredential",
    ]);
  });
});

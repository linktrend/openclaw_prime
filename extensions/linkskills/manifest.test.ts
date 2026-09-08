import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_LINKSKILLS_CONFIG, parseLinkskillsConfig } from "./src/config.js";

const root = path.dirname(fileURLToPath(import.meta.url));

describe("linkskills manifest/config", () => {
  it("declares default-disabled private plugin metadata", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, "openclaw.plugin.json"), "utf8"),
    ) as {
      id: string;
      enabledByDefault: boolean;
      activation: { onStartup: boolean };
      configSchema: { properties: Record<string, unknown> };
      configContracts: { secretInputs: { paths: Array<{ path: string }> } };
    };
    expect(manifest.id).toBe("linkskills");
    expect(manifest.enabledByDefault).toBe(false);
    expect(manifest.activation.onStartup).toBe(true);
    expect(manifest.configSchema.properties).toMatchObject({
      mcpDiscoveryRead: expect.any(Object),
      governedExecution: expect.any(Object),
      telemetryEnqueue: expect.any(Object),
      telemetryDrain: expect.any(Object),
      transportMode: expect.any(Object),
      mcpServerName: expect.any(Object),
      allowProductionLoopbackHttp: expect.any(Object),
      skillsCredential: expect.any(Object),
      redactionPolicyVersion: expect.any(Object),
      outboxMaxEntries: expect.any(Object),
    });
    expect(manifest.configContracts.secretInputs.paths.map((entry) => entry.path)).toEqual([
      "skillsCredential",
    ]);
    expect(JSON.stringify(manifest)).not.toContain("allowConversationAccess");
  });

  it("package.json points at the local entry and stays private", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
      name: string;
      private: boolean;
      openclaw: { extensions: string[] };
    };
    expect(pkg.name).toBe("@openclaw/linkskills");
    expect(pkg.private).toBe(true);
    expect(pkg.openclaw.extensions).toEqual(["./index.ts"]);
  });

  it("parses independent Skills flags and SecretRef credential", () => {
    const config = parseLinkskillsConfig({
      mcpDiscoveryRead: true,
      governedExecution: true,
      telemetryEnqueue: true,
      telemetryDrain: false,
      skillsCredential: {
        source: "env",
        provider: "default",
        id: "LINKTREND_SKILLS_TEST_TOKEN",
      },
      redactionPolicyVersion: "skills.telemetry.v0",
      batchMaxEvents: 8,
      environment: "stage",
    });
    expect(config.mcpDiscoveryRead).toBe(true);
    expect(config.governedExecution).toBe(true);
    expect(config.telemetryEnqueue).toBe(true);
    expect(config.telemetryDrain).toBe(false);
    expect(config.skillsCredential).toEqual({
      source: "env",
      provider: "default",
      id: "LINKTREND_SKILLS_TEST_TOKEN",
    });
    expect(config.batchMaxEvents).toBe(8);
    expect(config.environment).toBe("stage");
  });

  it("defaults all write flags off and transportMode disabled", () => {
    expect(parseLinkskillsConfig({})).toMatchObject({
      mcpDiscoveryRead: false,
      governedExecution: false,
      telemetryEnqueue: false,
      telemetryDrain: false,
      transportMode: "disabled",
      mcpServerName: "linkskills",
      redactionPolicyVersion: DEFAULT_LINKSKILLS_CONFIG.redactionPolicyVersion,
    });
  });

  it("allows production HTTP only for an explicitly gated loopback Skills endpoint", () => {
    expect(
      parseLinkskillsConfig({
        environment: "production",
        transportMode: "http",
        skillsEndpoint: "http://127.0.0.1:18788",
        allowProductionLoopbackHttp: true,
      }),
    ).toMatchObject({
      skillsEndpoint: "http://127.0.0.1:18788",
      allowProductionLoopbackHttp: true,
    });
    expect(() =>
      parseLinkskillsConfig({
        environment: "production",
        transportMode: "http",
        skillsEndpoint: "http://127.0.0.1:18788",
      }),
    ).toThrow(/HTTPS/);
  });

  it("rejects malformed SecretRef credentials", () => {
    expect(() =>
      parseLinkskillsConfig({
        skillsCredential: { source: "env", provider: "default" },
      }),
    ).toThrow(/SecretRef/);
  });

  it("parses optional machineToken with SecretRef assertion key", () => {
    const config = parseLinkskillsConfig({
      machineToken: {
        bindingId: "linkskills-stage",
        issuerUrl: "https://issuer.example.test",
        clientId: "skills-client",
        clientAssertionKeyRef: {
          source: "env",
          provider: "default",
          id: "LINKTREND_SKILLS_ASSERTION_PEM",
        },
      },
    });
    expect(config.machineToken).toEqual({
      bindingId: "linkskills-stage",
      issuerUrl: "https://issuer.example.test",
      clientId: "skills-client",
      clientAssertionKeyRef: {
        source: "env",
        provider: "default",
        id: "LINKTREND_SKILLS_ASSERTION_PEM",
      },
    });
    expect(parseLinkskillsConfig({}).machineToken).toBeUndefined();
  });

  it("rejects literal string clientAssertionKeyRef (SecretRef-only)", () => {
    expect(() =>
      parseLinkskillsConfig({
        machineToken: {
          bindingId: "linkskills-stage",
          issuerUrl: "https://issuer.example.test",
          clientId: "skills-client",
          clientAssertionKeyRef: "literal-pem",
        },
      }),
    ).toThrow(/SecretRef object/);
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
    expect(manifest.configContracts.secretInputs.paths.map((entry) => entry.path)).toEqual([
      "skillsCredential",
    ]);
  });
});

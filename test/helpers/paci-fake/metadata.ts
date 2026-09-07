/**
 * TEST ONLY — RFC 8414 metadata matching Platform `buildAuthorizationServerMetadata`.
 *
 * Omits `authorization_endpoint` entirely (not null).
 * `response_types_supported: []`.
 */
import { DEFAULT_SCOPES_SUPPORTED, PACI_ALG } from "./constants.js";

export type PaciFakeEndpointPaths = {
  tokenPath: string;
  introspectPath: string;
  jwksPath: string;
  metadataPath: string;
};

export const DEFAULT_ENDPOINT_PATHS: PaciFakeEndpointPaths = {
  tokenPath: "/oauth/token",
  introspectPath: "/oauth/introspect",
  jwksPath: "/.well-known/jwks.json",
  metadataPath: "/.well-known/oauth-authorization-server",
};

export type PaciFakeAuthorizationServerMetadata = {
  issuer: string;
  token_endpoint: string;
  jwks_uri: string;
  introspection_endpoint: string;
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  token_endpoint_auth_signing_alg_values_supported: string[];
  introspection_endpoint_auth_methods_supported: string[];
  response_types_supported: string[];
  scopes_supported: string[];
  service_documentation?: string;
  // authorization_endpoint intentionally omitted — do not set null
};

/**
 * Build RFC 8414 metadata exact to Platform Phase-1 local/fake.
 * Denial fixtures may override grant/auth methods via options.
 */
export function buildPaciFakeAuthorizationServerMetadata(options: {
  issuer: string;
  scopesSupported?: readonly string[];
  serviceDocumentation?: string;
  paths?: Partial<PaciFakeEndpointPaths>;
  /** Test denial: omit private_key_jwt. */
  omitPrivateKeyJwt?: boolean;
  /** Test denial: omit client_credentials (interactive-only). */
  omitClientCredentials?: boolean;
}): PaciFakeAuthorizationServerMetadata {
  const issuer = options.issuer.replace(/\/$/u, "");
  const paths = { ...DEFAULT_ENDPOINT_PATHS, ...options.paths };
  const grantTypes = options.omitClientCredentials
    ? ["authorization_code"]
    : ["client_credentials"];
  const authMethods = options.omitPrivateKeyJwt ? ["client_secret_basic"] : ["private_key_jwt"];
  const responseTypes = options.omitClientCredentials ? ["code"] : [];

  const metadata: PaciFakeAuthorizationServerMetadata = {
    issuer,
    token_endpoint: `${issuer}${paths.tokenPath}`,
    jwks_uri: `${issuer}${paths.jwksPath}`,
    introspection_endpoint: `${issuer}${paths.introspectPath}`,
    grant_types_supported: grantTypes,
    token_endpoint_auth_methods_supported: authMethods,
    token_endpoint_auth_signing_alg_values_supported: [PACI_ALG],
    introspection_endpoint_auth_methods_supported: options.omitPrivateKeyJwt
      ? ["client_secret_basic"]
      : ["private_key_jwt"],
    response_types_supported: responseTypes,
    scopes_supported: [...(options.scopesSupported ?? DEFAULT_SCOPES_SUPPORTED)],
  };
  if (options.serviceDocumentation) {
    metadata.service_documentation = options.serviceDocumentation;
  }
  return metadata;
}

/**
 * TEST ONLY — OpenClaw PACI fake helpers (Platform Phase-1 exact adapter).
 */
export {
  AUTH_CLAIMS_CLAIM_KEY,
  CLIENT_ASSERTION_MAX_TTL_SECONDS,
  CLIENT_ASSERTION_TYPE,
  DEFAULT_SCOPES_SUPPORTED,
  FORBIDDEN_ALGS,
  FORBIDDEN_HEADER_KEY_PARAMS,
  PACI_ALG,
  PACI_FAKE_ACCESS_TOKEN_EXPIRES_IN_SECONDS,
  PACI_JWT_TYP,
  PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION,
} from "./constants.js";

export {
  createPaciFakeEs256KeyPair,
  resetPaciFakeEs256KeyPairCache,
  type PaciFakeEs256KeyPair,
} from "./keys.js";

export {
  buildPaciFakeAuthorizationServerMetadata,
  DEFAULT_ENDPOINT_PATHS,
  type PaciFakeAuthorizationServerMetadata,
  type PaciFakeEndpointPaths,
} from "./metadata.js";

export {
  createPaciFakeServer,
  denyAllIntrospectionPolicy,
  type PaciFakeDomain,
  type PaciFakeHttpFault,
  type PaciFakeIntrospectionPolicy,
  type PaciFakeMintOverrides,
  type PaciFakeRegisterClientInput,
  type PaciFakeServer,
  type PaciFakeServerOptions,
} from "./server.js";

export {
  formatScopeString,
  parseRequestedScopes,
  PaciFakeScopeError,
  resolveGrantedServiceScopes,
} from "./scope.js";

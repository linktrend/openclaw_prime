/**
 * Public Plugin SDK contract for machine-token (client_credentials + private_key_jwt).
 *
 * Plugins receive a host-injected, already identity/binding/domain-scoped facade.
 * Privileged construction, grant selection, raw resolution, and global cache
 * controls live in `src/agents/machine-token-host.ts` and must not be imported
 * by external or bundled plugins.
 */
import type { ResolvedMachineToken } from "../agents/machine-token-types.js";

export type {
  MachineTokenBinding,
  MachineTokenBindingHealth,
  MachineTokenKeyRefIdentity,
  MachineTokenPluginFacade,
  ResolvedMachineToken,
} from "../agents/machine-token-types.js";

export { assertMachineTokenIssuerUrl } from "../agents/machine-token-discovery.js";

export { fingerprintMachineTokenKeyRef } from "../agents/machine-token-fingerprint.js";

/**
 * Build an Authorization header object from a resolved machine token.
 * Does not log or retain the access token beyond the returned value.
 */
export function authorizationHeaderFromMachineToken(token: ResolvedMachineToken): {
  authorization: string;
} {
  return { authorization: `Bearer ${token.accessToken}` };
}

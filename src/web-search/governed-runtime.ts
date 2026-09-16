/**
 * Source-only fail-closed admission for web_search.
 *
 * Ordinary public research is a low-risk public_read. Search never starts a
 * browser, never opens downloads, and never treats page text as approval.
 */
import {
  evaluateBrowserCapability,
  GovernedBrowserUrlError,
  type BrowserCapabilityRequest,
  type BrowserPolicyDecision,
} from "../agents/sandbox/browser-policy.js";

export type GovernedWebSearchAdmission = {
  query: string;
  decision: BrowserPolicyDecision;
};

/** Admit a public web_search query without launching a browser runtime. */
export function admitGovernedWebSearch(params: {
  query: unknown;
  capability?: BrowserCapabilityRequest["capability"];
  authenticated?: boolean;
  identityUncertain?: boolean;
  termsUnclear?: boolean;
  botProtection?: boolean;
  credentialSource?: BrowserCapabilityRequest["credentialSource"];
  standingRule?: BrowserCapabilityRequest["standingRule"];
  currentApproval?: BrowserCapabilityRequest["currentApproval"];
  activateStandingRule?: boolean;
}): GovernedWebSearchAdmission {
  const query = typeof params.query === "string" ? params.query.trim() : "";
  if (!query) {
    throw new GovernedBrowserUrlError("web_search query is required");
  }

  const decision = evaluateBrowserCapability({
    capability: params.capability ?? "public_read",
    authenticated: params.authenticated,
    identityUncertain: params.identityUncertain,
    termsUnclear: params.termsUnclear,
    botProtection: params.botProtection,
    credentialSource: params.credentialSource,
    standingRule: params.standingRule,
    currentApproval: params.currentApproval,
    activateStandingRule: params.activateStandingRule,
  });
  if (decision.status !== "allow") {
    throw new GovernedBrowserUrlError(decision.reason);
  }
  return { query, decision };
}

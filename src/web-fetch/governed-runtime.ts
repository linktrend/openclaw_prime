/**
 * Source-only fail-closed admission for web_fetch.
 *
 * Public page reads reuse the governed browser capability/URL policy. This
 * module never starts Chromium, never reads credentials, and never spends.
 */
import {
  evaluateBrowserCapability,
  GovernedBrowserUrlError,
  parseGovernedBrowserUrl,
  type BrowserCapabilityRequest,
  type BrowserPolicyDecision,
} from "../agents/sandbox/browser-policy.js";

export type GovernedWebFetchAdmission = {
  url: URL;
  decision: BrowserPolicyDecision;
};

function requireHttpFetchUrl(rawUrl: string): URL {
  const parsed = parseGovernedBrowserUrl(rawUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid URL: must be http or https");
  }
  return parsed;
}

/** Admit a public web_fetch URL without launching a browser runtime. */
export function admitGovernedWebFetch(params: {
  url: string;
  capability?: BrowserCapabilityRequest["capability"];
  authenticated?: boolean;
  identityUncertain?: boolean;
  termsUnclear?: boolean;
  botProtection?: boolean;
  credentialSource?: BrowserCapabilityRequest["credentialSource"];
  standingRule?: BrowserCapabilityRequest["standingRule"];
  currentApproval?: BrowserCapabilityRequest["currentApproval"];
  activateStandingRule?: boolean;
}): GovernedWebFetchAdmission {
  let parsed: URL;
  try {
    parsed = requireHttpFetchUrl(params.url);
  } catch (error) {
    if (error instanceof GovernedBrowserUrlError) {
      if (error.message.includes("credentials")) {
        throw error;
      }
      throw new Error("Invalid URL: must be http or https");
    }
    throw error;
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
  return { url: parsed, decision };
}

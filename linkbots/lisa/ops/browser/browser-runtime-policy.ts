/**
 * Lisa VPS browser deployment contract.
 *
 * This file is a declarative source asset. Deployment tooling may consume it,
 * but importing it never starts Chromium, changes a service, or reads secrets.
 */
import {
  GOVERNED_BROWSER_RUNTIME_MODE,
  resolveBrowserDownloadPolicy,
  resolveBrowserRuntimeLimits,
  type BrowserRuntimeLimits,
  type BrowserDownloadPolicy,
} from "../../../../src/agents/sandbox/browser-policy.js";

export const LISA_BROWSER_RUNTIME_CONTRACT = "lisa-vps-governed-browser-v1" as const;

export type LisaBrowserRuntimePolicy = {
  contract: typeof LISA_BROWSER_RUNTIME_CONTRACT;
  profile: "lisa-vps";
  mode: typeof GOVERNED_BROWSER_RUNTIME_MODE;
  headless: true;
  privateNetwork: "deny-by-default";
  redirects: "revalidate-every-hop";
  credentials: "never-model-visible";
  downloads: "isolated-never-open-or-execute";
  visualLogin: "temporary-operator-only";
  limits: BrowserRuntimeLimits;
  downloadPolicy: BrowserDownloadPolicy;
};

/** Resolve a deterministic Lisa runtime contract without touching the VPS. */
export function resolveLisaBrowserRuntimePolicy(params: {
  stateDirectory: string;
  limits?: Partial<BrowserRuntimeLimits>;
}): LisaBrowserRuntimePolicy {
  return {
    contract: LISA_BROWSER_RUNTIME_CONTRACT,
    profile: "lisa-vps",
    mode: GOVERNED_BROWSER_RUNTIME_MODE,
    headless: true,
    privateNetwork: "deny-by-default",
    redirects: "revalidate-every-hop",
    credentials: "never-model-visible",
    downloads: "isolated-never-open-or-execute",
    visualLogin: "temporary-operator-only",
    limits: resolveBrowserRuntimeLimits(params.limits),
    downloadPolicy: resolveBrowserDownloadPolicy(params.stateDirectory),
  };
}

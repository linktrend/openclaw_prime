/**
 * Compile-time + runtime shape guard for createTestPluginApi.
 * If OpenClawPluginApiWithoutFacades gains a required flat method and the test
 * helper omits it, `satisfies` in plugin-test-api.ts fails typecheck; this file
 * also asserts unregisterMcpServerToolFilter is present and callable.
 */
import { describe, expect, expectTypeOf, it } from "vitest";
import type { OpenClawPluginApiWithoutFacades } from "../plugins/api-facades.js";
import { createTestPluginApi } from "./plugin-test-api.js";

describe("plugin-test-api API shape", () => {
  it("exposes unregisterMcpServerToolFilter and keeps flat API assignable", () => {
    const api = createTestPluginApi();
    expectTypeOf(api.unregisterMcpServerToolFilter).toEqualTypeOf<(serverName: string) => void>();
    expectTypeOf(api.registerMcpServerToolFilter).toBeFunction();
    expect(() => api.unregisterMcpServerToolFilter("linkbrain")).not.toThrow();

    // Facades are attached after the flat satisfies check; strip them and prove
    // the remaining surface still matches the without-facades contract shape.
    const { agent: _a, lifecycle: _l, runContext: _r, session: _s, ...flat } = api;
    const checked: OpenClawPluginApiWithoutFacades = flat;
    expect(typeof checked.unregisterMcpServerToolFilter).toBe("function");
  });
});

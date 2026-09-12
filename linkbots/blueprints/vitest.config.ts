import { defineConfig } from "vitest/config";
import { sharedVitestConfig } from "../../test/vitest/vitest.shared.config.ts";

const sharedTest = sharedVitestConfig.test ?? {};

export default defineConfig({
  ...sharedVitestConfig,
  test: {
    ...sharedTest,
    name: "blueprints",
    include: ["**/*.test.ts"],
    exclude: [...(sharedTest.exclude ?? [])],
  },
});

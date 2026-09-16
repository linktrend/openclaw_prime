import { defineConfig } from "vitest/config";

/** Local PKT-09 deployment proof. Root Vitest projects do not include linkbots/. */
export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    environment: "node",
  },
});

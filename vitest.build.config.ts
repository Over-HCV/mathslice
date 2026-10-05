import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/*
  The build smoke, kept out of `pnpm test` on purpose.

  Everything under src/**\/*.test.ts runs in milliseconds against pure functions and must stay
  runnable at any moment. These assertions read dist/, so they are meaningless — and confusingly
  green — without a build in front of them. Two configs, one alias, no ambiguity about which suite
  needs what: `pnpm test` is always safe to run, `pnpm test:build` says what it depends on.
*/
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["scripts/**/*.smoke.ts"],
  },
});

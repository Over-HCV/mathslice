import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/*
  Vitest exists here for one reason: the .md ⇄ NoteDoc round-trip in src/lib/notes/ is the
  single point where content can be silently corrupted, and "silently" is only survivable if a
  test watches it. Everything worth testing at this layer is pure logic, so there is no
  environment beyond node — add jsdom the day a component test earns it, not before.

  The alias is duplicated from tsconfig.json because tsc resolves types and Vite resolves
  modules; neither reads the other's config.
*/
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});

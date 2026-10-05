// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://mathslice.app",
  integrations: [
    react(),
    mdx(),
    sitemap({
      // The identity lab is a private tooling route — keep it out. /motor is public
      // on purpose: it is how anyone can see where the engine stands.
      filter: (page) => !page.includes("/visual-identity"),
    }),
  ],
  i18n: {
    defaultLocale: "es",
    locales: ["es", "en"],
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});

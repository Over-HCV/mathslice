import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DISCOVER_SEGMENT, PEEK_SEGMENT } from "@/lib/notes/refs";

/*
  A file path cannot import a constant. `peekUrl` builds every peek URL out of PEEK_SEGMENT, and
  the files that answer those URLs are named by their location on disk — so renaming one without
  the other produces a site whose every peek 404s, with nothing failing to say so.

  Astro also drops any route with a `_`-prefixed segment SILENTLY (isPublicRoute in core/util.js),
  which is how the original design for this endpoint would have shipped as zero routes. Hence the
  second assertion: the segment has to be a real, routable name.
*/

const page = (locale: string) => `src/pages/${locale ? `${locale}/` : ""}`;

describe("the peek endpoint files are where peekUrl says they are", () => {
  it("exists in both locales", () => {
    for (const locale of ["", "en"]) {
      expect(existsSync(`${page(locale)}${PEEK_SEGMENT}/[...slug].json.ts`)).toBe(true);
    }
  });

  it("mirrors the page routes exactly", () => {
    for (const locale of ["", "en"]) {
      expect(existsSync(`${page(locale)}${DISCOVER_SEGMENT}/[...slug].astro`)).toBe(true);
    }
  });

  it("uses a routable segment — a leading underscore would emit nothing", () => {
    expect(PEEK_SEGMENT.startsWith("_")).toBe(false);
  });
});

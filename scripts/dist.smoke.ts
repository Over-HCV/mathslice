import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { LOCALES } from "@/i18n";
import { parseRef, peekUrl, DISCOVER_SEGMENT, PEEK_SEGMENT } from "@/lib/notes/refs";
import type { PeekDoc } from "@/lib/peek";

/*
  What the built site actually contains — the layer no pure test can reach.

  Run after `pnpm build`. The load-bearing assertion is the first one: every peek trigger the site
  rendered, put through the SAME peekUrl() the browser will call, names a file that exists. That is
  what makes the endpoint provably correct rather than plausibly correct, and it uses the real
  function over the real output, so a change to either side is caught by the other.

  Extends the idea of engine/scripts/browser-check.mjs — look at what the page produced, not at
  what the code intended.
*/

const DIST = "dist";

/** Every locale's URL prefix, in the shape a dist path uses. `""` for the default locale. */
const PREFIXES = LOCALES.map((l) => (l === "es" ? "" : l));

const walk = (dir: string, match: (path: string) => boolean): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path, match);
    return match(path) ? [path] : [];
  });
};

const topicPages = () =>
  PREFIXES.flatMap((prefix) => walk(join(DIST, prefix, DISCOVER_SEGMENT), (p) => p.endsWith(".html")));

const peekFiles = () =>
  PREFIXES.flatMap((prefix) => walk(join(DIST, prefix, PEEK_SEGMENT), (p) => p.endsWith(".json")));

/** The locale a built file belongs to, read off its path. */
const localeOf = (path: string) => (path.startsWith(`${DIST}/en/`) ? "en" : "es");

const read = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

describe("the build exists", () => {
  it("has topic pages and peek documents", () => {
    expect(existsSync(DIST)).toBe(true);
    expect(topicPages().length).toBeGreaterThan(0);
    expect(peekFiles().length).toBeGreaterThan(0);
  });
});

describe("every peek trigger the site rendered has a document behind it", () => {
  it("resolves through the production peekUrl", () => {
    const missing: string[] = [];
    let triggers = 0;

    for (const page of topicPages()) {
      const html = readFileSync(page, "utf8");
      for (const [, raw] of html.matchAll(/data-peek-ref="([^"]*)"/g)) {
        triggers++;
        const ref = parseRef(raw);
        // An unparseable ref would already have failed the build in validate.ts.
        expect(ref, `${page} renders an unparseable ref "${raw}"`).not.toBeNull();

        const url = peekUrl(ref!, localeOf(page));
        if (!existsSync(join(DIST, url))) missing.push(`${page} → ${raw} → ${url}`);
      }
    }

    expect(missing).toEqual([]);
    // Not an assertion yet: the corpus grows its first refs with the 00-axioms rewrite. Reported
    // so a run that silently checks nothing is visible as such.
    if (!triggers) console.warn("build smoke: no data-peek-ref in dist yet — nothing to resolve");
  });
});

describe("pages and peek documents answer the same URLs", () => {
  it("has one peek file per topic page", () => {
    const pageSlugs = topicPages()
      .map((p) => p.replace(/^dist\/(en\/)?descubre\//, "$1").replace(/\/index\.html$/, ""))
      .sort();
    const peekSlugs = peekFiles()
      .map((p) => p.replace(/^dist\/(en\/)?peek\//, "$1").replace(/\.json$/, ""))
      .sort();
    expect(peekSlugs).toEqual(pageSlugs);
  });
});

describe("a peek document is the shape the panel reads", () => {
  const path = `${DIST}/${PEEK_SEGMENT}/a-origins/00-axioms.json`;

  it("carries a whole document and the link back to its page", () => {
    const doc = read<PeekDoc>(path);
    expect(doc.blocks.length).toBeGreaterThan(0);
    expect(doc.title).toBeTruthy();
    expect(doc.href).toBe("/descubre/a-origins/00-axioms");
    expect(doc.ref).toBe("a-origins/00-axioms/know");
  });

  it("ships only the links its own blocks reach, never the site's whole table", () => {
    // The site table is a few hundred entries. A projection regression shows up here as a number.
    for (const file of peekFiles()) {
      expect(Object.keys(read<PeekDoc>(file).links).length, file).toBeLessThan(40);
    }
  });

  it("points the English twin at the English page", () => {
    const doc = read<PeekDoc>(`${DIST}/en/${PEEK_SEGMENT}/a-origins/00-axioms.json`);
    expect(doc.href).toBe("/en/descubre/a-origins/00-axioms");
  });
});

describe("the peek endpoint is not a page", () => {
  it("stays out of the sitemap", () => {
    const sitemap = walk(DIST, (p) => /sitemap-\d+\.xml$/.test(p));
    expect(sitemap.length).toBeGreaterThan(0);
    for (const file of sitemap) expect(readFileSync(file, "utf8")).not.toContain(`/${PEEK_SEGMENT}/`);
  });
});

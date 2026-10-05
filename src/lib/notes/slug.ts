/*
  slug.ts — heading anchors, computed GitHub's way.

  This matches github-slugger deliberately, not approximately. The same .md file is read in two
  places: on this site and on GitHub, where it is also the research source for a video. A link
  written as `…/01-info.md#el-mecanismo` has to land on the same heading in both, and it only does
  that if the two agree character for character on what "el mecanismo" slugifies to.

  Accents survive (`\p{L}` covers them), so "Información" → "informacion" would be WRONG — it
  slugifies to "información". That looks surprising in a URL and is nonetheless what GitHub does.
*/

/** Everything a slug drops: punctuation, symbols, emoji. Letters, numbers, `_`, `-` and spaces stay. */
const DROPPED = /[^\p{L}\p{N}\p{Pc}\p{Pd}\s]/gu;

export function slugify(text: string): string {
  return text.trim().toLowerCase().replace(DROPPED, "").replace(/\s+/g, "-");
}

/**
 * A slugger for one document: repeated headings get `-1`, `-2`, … exactly as GitHub numbers them.
 *
 * It is stateful because uniqueness is a property of the document, not of a string — which is why
 * this returns a function instead of exporting one.
 */
export function makeSlugger(): (text: string) => string {
  const seen = new Map<string, number>();
  return (text: string) => {
    const base = slugify(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count ? `${base}-${count}` : base;
  };
}

/** The visible text of a heading block: `## Definiciones formales` → `Definiciones formales`. */
export const headingText = (content: string): string => content.replace(/^#+\s*/, "").trim();

/** `###` → 3. Anything without hashes is a level-2 heading, which is what the editor creates. */
export const headingLevel = (content: string): number => content.match(/^(#{1,6})\s/)?.[1].length ?? 2;

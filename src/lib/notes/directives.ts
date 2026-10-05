/*
  directives.ts — the thin syntax layer that markdown does not have.

  Three constructs, one rule each:

    :::atom{…}   wraps markdown        → must keep rendering on GitHub, so it is a directive
    ::embed[…]{} is a leaf directive   → same reason
    ```lang      wraps opaque data     → CommonMark already treats a fence body as opaque, so an
                                          artifact's JSON cannot break the document around it

  The grammar is deliberately smaller than remark-directive's: `key="value"` only, quotes
  mandatory, no `#id`/`.class` shorthand. Parsing is one regex and serialising is exact, which is
  what makes the .md ⇄ NoteDoc round-trip a property we can test rather than a hope.

  Nothing here reads a file or resolves a ref. `a-origins/00-axioms/info#el-mecanismo` is an
  opaque string until the atom index (build time) resolves it and fails loudly if it cannot.
*/

/** Attribute bag of a directive. Insertion order is source order, so re-emitting is byte-exact. */
export type Attrs = Record<string, string>;

const ATTR = /([a-zA-Z][\w-]*)="([^"]*)"/g;

export function parseAttrs(source: string): Attrs {
  const attrs: Attrs = {};
  for (const [, key, value] of source.matchAll(ATTR)) attrs[key] = value;
  return attrs;
}

export function writeAttrs(attrs: Attrs): string {
  return Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
}

/** Comma-separated attribute value (`needs="a,b"`) → list. Empty string means empty list, not [""]. */
export const parseList = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/* ————————————————————————————— Embeds ————————————————————————————— */

export type Embed = { ref: string; label: string };

const EMBED = /^::embed(?:\[([^\]]*)\])?\{(.*)\}$/;

/**
 * A block that is entirely `::embed[label]{ref="…"}`.
 *
 * The label is optional and, when absent, the renderer takes the target's own title — but an
 * author who wrote one gets it back verbatim, because a link whose text you chose is the whole
 * reason to write the label form.
 */
export function detectEmbed(content: string): Embed | null {
  const m = content.trim().match(EMBED);
  if (!m) return null;
  const ref = parseAttrs(m[2]).ref;
  return ref ? { ref, label: m[1] ?? "" } : null;
}

export function writeEmbed({ ref, label }: Embed): string {
  return `::embed${label ? `[${label}]` : ""}{${writeAttrs({ ref })}}`;
}

/* ———————————————————————————— Atom refs ———————————————————————————— */

export type AtomRef = { ref: string; label: string };

// Two forms on purpose. GitHub's sanitiser drops unknown tags but KEEPS their children, so the
// labelled form survives inside a sentence and the self-closing one does not — which is why the
// self-closing form is only ever used on a line of its own, where a missing card costs nothing.
const ATOM_REF_SOURCE = String.raw`<Atom\s+([^>]*?)\s*(?:\/>|>([\s\S]*?)<\/Atom>)`;

/** The tag alone on a block. */
const ATOM_REF = new RegExp(`^${ATOM_REF_SOURCE}$`);

/** The same tag anywhere inside a sentence. One source pattern for both so the block form and the
 *  inline form can never come to disagree about what an `<Atom>` looks like. */
export const INLINE_ATOM = new RegExp(ATOM_REF_SOURCE, "g");

export function detectAtomRef(content: string): AtomRef | null {
  const m = content.trim().match(ATOM_REF);
  if (!m) return null;
  const ref = parseAttrs(m[1]).ref;
  return ref ? { ref, label: m[2] ?? "" } : null;
}

/**
 * Every inline `<Atom ref>` in a markdown string.
 *
 * Lives here, in the grammar, rather than beside the remark plugin that also matches the tag: the
 * build validates these refs and so does the peek's link projection, and neither has any business
 * importing remark, rehype and KaTeX to ask what a string points at.
 */
export function inlineRefsIn(markdown: string): string[] {
  return [...markdown.matchAll(INLINE_ATOM)].map((m) => parseAttrs(m[1]).ref).filter(Boolean);
}

export function writeAtomRef({ ref, label }: AtomRef): string {
  const attrs = writeAttrs({ ref });
  return label ? `<Atom ${attrs}>${label}</Atom>` : `<Atom ${attrs} />`;
}

/* ———————————————————————— Artifact fences ———————————————————————— */

/**
 * Fence languages that carry an artifact instead of source code.
 *
 * A fence is the right container because the body never has to be valid anything-in-particular
 * to the markdown parser, so an artifact's JSON can contain `$$`, backticks or colons without
 * reaching out and breaking the document. The cost is that GitHub shows it as a code box, which
 * is an honest fallback: it is data, and you can read it.
 */
export const ARTIFACT_LANGS = ["mafs", "diagram", "axiom-toggle", "derivation", "knowledge-graph"] as const;
export type ArtifactName = (typeof ARTIFACT_LANGS)[number];

const ARTIFACTS = new Set<string>(ARTIFACT_LANGS);
export const isArtifactLang = (lang: string): lang is ArtifactName => ARTIFACTS.has(lang);

/**
 * A fence's info string: the language plus the same `key="value"` attributes as a directive.
 *
 * ```` ```lean theorem="MathSlice.inverse_unique_sound" ````
 *
 * Attributes on a fence are what let LeanProof name the claim it is showing without inventing a
 * block type for it — a `lean` fence is still a `lean` fence, it just says what it proves.
 */
export type FenceInfo = { lang: string; attrs: Attrs };

export function parseFenceInfo(info: string): FenceInfo {
  const trimmed = info.trim();
  const space = trimmed.search(/\s/);
  if (space === -1) return { lang: trimmed.toLowerCase(), attrs: {} };
  return { lang: trimmed.slice(0, space).toLowerCase(), attrs: parseAttrs(trimmed.slice(space)) };
}

export function writeFenceInfo({ lang, attrs }: FenceInfo): string {
  const written = writeAttrs(attrs);
  return written ? `${lang} ${written}` : lang;
}

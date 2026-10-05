/*
  refs.ts — the grammar of every pointer a note can hold, and the URL each one becomes.

  One string does both jobs:
    a-origins/00-axioms/info#el-mecanismo   a level of a topic, optionally at a heading
    a-origins/00-axioms/sistema-formal      an atom

  The LAST segment decides which: the three level keys are reserved, anything else is an atom's
  local id. Reading the tail instead of counting segments is what keeps
  `a-origins/01-mathematical-logic/00-propositional-logic/data` working — topic paths are two or
  three deep today and nothing promises they stay that way.

  Refs speak the internal vocabulary (`info`), not the URL one (`informacion`). Translating
  happens once, here, so a ref written in a note never has to know how routing spells things.
*/

import { DEFAULT_LOCALE, LEVELS, LEVEL_SLUG, type Level, type Locale } from "@/i18n";

export type TopicLevelRef = { kind: "level"; topic: string; level: Level; anchor: string | null };
export type TopicAtomRef = { kind: "atom"; topic: string; atomId: string };
export type NoteRef = TopicLevelRef | TopicAtomRef;

const LEVEL_KEYS = new Set<string>(LEVELS);

/** `null` for anything that is not a ref at all — a bare word, an absolute URL, an empty string.
 *  Callers report it as an authoring error; this function never throws. */
export function parseRef(raw: string): NoteRef | null {
  const [path, anchor = null] = raw.trim().split("#", 2);
  const segments = path.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const tail = segments[segments.length - 1];
  const topic = segments.slice(0, -1).join("/");

  if (LEVEL_KEYS.has(tail)) return { kind: "level", topic, level: tail as Level, anchor };
  return { kind: "atom", topic, atomId: tail };
}

/** The id the ref must resolve to in the index. Level refs drop the anchor: an anchor points
 *  inside a document that either exists or does not, and only the document can be validated. */
export function refTargetId(ref: NoteRef): string {
  return ref.kind === "level" ? `${ref.topic}/${ref.level}` : `${ref.topic}/${ref.atomId}`;
}

/** The section every topic page lives under, in both locales. */
export const DISCOVER_SEGMENT = "descubre";
/** The segment that turns an atom into a page of its own. */
export const ATOM_SEGMENT = "atomo";
/**
 * The section the peek endpoint answers under — the same slugs as DISCOVER_SEGMENT, serving JSON.
 *
 * NOT `_peek`: Astro drops any route whose path has a segment starting with `_`
 * (`isPublicRoute` in core/util.js, which both isPage and isEndpoint gate on), and it drops it
 * silently — no route, no warning. A file path cannot import this constant, so a test asserts the
 * two endpoint files exist where it says they do.
 */
export const PEEK_SEGMENT = "peek";

/** What `[...slug]` receives — the URL minus the section and the locale prefix. Routing and link
 *  building read it from here so a route and the link to it can never disagree. */
export const topicSlug = (topic: string, level: Level): string =>
  [topic, LEVEL_SLUG[level]].filter(Boolean).join("/");

export const atomSlug = (topic: string, atomId: string): string => `${topic}/${ATOM_SEGMENT}/${atomId}`;

export const topicHref = (topic: string, level: Level, locale: Locale = DEFAULT_LOCALE): string =>
  join(prefix(locale), DISCOVER_SEGMENT, topicSlug(topic, level));

export const atomHref = (topic: string, atomId: string, locale: Locale = DEFAULT_LOCALE): string =>
  join(prefix(locale), DISCOVER_SEGMENT, atomSlug(topic, atomId));

export function refHref(ref: NoteRef, locale: Locale = DEFAULT_LOCALE): string {
  if (ref.kind === "atom") return atomHref(ref.topic, ref.atomId, locale);
  return topicHref(ref.topic, ref.level, locale) + (ref.anchor ? `#${ref.anchor}` : "");
}

/** Where the peek panel fetches this ref from. No anchor: the anchor points inside the document,
 *  and the document is what gets fetched — scrolling to it is the panel's job, not the URL's. */
export function peekUrl(ref: NoteRef, locale: Locale = DEFAULT_LOCALE): string {
  const slug = ref.kind === "atom" ? atomSlug(ref.topic, ref.atomId) : topicSlug(ref.topic, ref.level);
  return `${join(prefix(locale), PEEK_SEGMENT, slug)}.json`;
}

/* ————————————————————————————— resolution ————————————————————————————— */

/** Every ref the site can resolve → where it goes and what to call it. Keyed WITHOUT anchors,
 *  because that is what a record has: one entry per document, not per heading inside it. */
export type LinkTable = Record<string, { href: string; title: string }>;

/**
 * A raw ref, as written in a note, resolved against a link table.
 *
 * The anchor is the whole reason this exists. A naive `links[raw]` misses every anchored ref —
 * `…/info#el-mecanismo` is not a key and never will be — and renders it as a dead label, which is
 * exactly what the site did before this function. Both hosts and the peek go through here so that
 * can only ever be true in zero places or all three.
 */
export function resolveRefIn(links: LinkTable, raw: string): { href: string; title: string } | null {
  const ref = parseRef(raw);
  if (!ref) return null;

  const target = links[refTargetId(ref)];
  if (!target) return null;

  const anchor = ref.kind === "level" ? ref.anchor : null;
  return anchor ? { href: `${target.href}#${anchor}`, title: target.title } : target;
}

/** The default locale is unprefixed — the routing rule astro.config.mjs already sets. */
const prefix = (locale: Locale): string => (locale === DEFAULT_LOCALE ? "" : locale);

/** Empty pieces are dropped rather than joined: the locale prefix is empty for Spanish and
 *  `LEVEL_SLUG.know` is empty because the entry level IS the topic URL. Joining blindly would
 *  give every Know page a trailing slash and every English page a doubled one. */
const join = (...parts: string[]): string => "/" + parts.filter(Boolean).join("/");

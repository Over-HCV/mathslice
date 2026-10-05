/*
  topicRoutes — the single enumerator of every published topic URL, in every locale.

  One function, two callers (src/pages/descubre/[...slug].astro and its /en twin), because the
  bug this exists to prevent is exactly the one the site has today: mathsTree.ts generates
  /en/descubre/… hrefs and no page answers them. Routes that come from one list cannot drift apart.

  Two rules worth stating out loud:

  1. The DEFAULT LOCALE defines the route set. A topic exists because it is written in Spanish;
     a translation adds a rendering of a route, never a route. That is why an untranslated page
     renders the Spanish record with `translated: false` rather than 404ing — a missing
     translation must not break a link the navigation itself produced.

  2. Drafts have no routes at all. media/maths is also video research, so "published" is a thing a
     file opts into, not the default.

  Pure: it takes records and returns routes. `getCollection` lives in the pages, so this whole
  file is testable without an Astro runtime.
*/

import { DEFAULT_LOCALE, LEVELS, type Level, type Locale } from "@/i18n";
import { atomSlug, topicHref, topicSlug } from "@/lib/notes/refs";

/** The shape a route needs from a topics entry — structural, so a collection entry fits as-is. */
export type LevelSource = { ref: string; topic: string; level: Level; lang: Locale; draft: boolean };
export type AtomSource = { ref: string; topic: string; localId: string; lang: Locale };

export type TopicRoute = {
  kind: "level" | "atom";
  /** What `[...slug]` receives. */
  slug: string;
  topic: string;
  level: Level;
  atomId: string | null;
  locale: Locale;
  /** False when the reader's language has no file and the default one is being shown instead. */
  translated: boolean;
  /** The collection entry to render: the reader's language when it exists, the default otherwise. */
  entryId: string;
};

export function topicRoutes(
  source: { topics: LevelSource[]; atoms: AtomSource[] },
  locale: Locale,
): TopicRoute[] {
  const published = new Set(
    source.topics.filter((t) => !t.draft && t.lang === DEFAULT_LOCALE).map((t) => t.topic),
  );
  const translations = new Set(source.topics.filter((t) => t.lang === locale).map((t) => t.ref));
  const atomTranslations = new Set(source.atoms.filter((a) => a.lang === locale).map((a) => a.ref));

  const levels: TopicRoute[] = source.topics
    .filter((t) => t.lang === DEFAULT_LOCALE && published.has(t.topic))
    .map((t) => ({
      kind: "level",
      slug: topicSlug(t.topic, t.level),
      topic: t.topic,
      level: t.level,
      atomId: null,
      locale,
      ...render(t.ref, locale, translations.has(t.ref)),
    }));

  const atoms: TopicRoute[] = source.atoms
    .filter((a) => a.lang === DEFAULT_LOCALE && published.has(a.topic))
    .map((a) => ({
      kind: "atom",
      slug: atomSlug(a.topic, a.localId),
      topic: a.topic,
      // An atom is always declared at the data level; the field is here so a route always answers
      // "which level am I inside", which is what the level navigation renders from.
      level: "data" as Level,
      atomId: a.localId,
      locale,
      ...render(a.ref, locale, atomTranslations.has(a.ref)),
    }));

  return [...levels, ...atoms].sort((a, b) => a.slug.localeCompare(b.slug));
}

const render = (ref: string, locale: Locale, translated: boolean) => ({
  translated,
  entryId: `${translated ? locale : DEFAULT_LOCALE}/${ref}`,
});

/** The three level links drawn on every topic page — the descent, always in reading order
 *  (know → info → data), which is the order LEVELS is declared in. */
export function levelNav(topic: string, locale: Locale, current: Level): { level: Level; href: string; current: boolean }[] {
  return LEVELS.map((level) => ({ level, href: topicHref(topic, level, locale), current: level === current }));
}

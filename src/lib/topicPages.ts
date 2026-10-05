/*
  topicPages — the bridge between the content collections and the two topic routes.

  Everything that needs `astro:content` lives here, so src/lib/topicRoutes.ts stays pure and
  testable and the page files stay five lines each. Both locales call the same two functions,
  which is what keeps /descubre and /en/descubre from drifting.
*/

import { getCollection } from "astro:content";

import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n";
import type { AtomRecord, TopicRecord } from "@/lib/notes/loadTopics";
import { atomHref, refHref, topicHref, type LinkTable } from "@/lib/notes/refs";
import { allRefsIn } from "@/lib/notes/render";
import { projectPeek, type PeekDoc } from "@/lib/peek";
import { topicRoutes, type TopicRoute } from "@/lib/topicRoutes";
import type { Block } from "@/lib/notes/model";

export type TopicContent = {
  route: TopicRoute;
  /** What the page is about — an atom's own page is titled by the atom, not by the level. */
  title: string;
  summary: string;
  blocks: Block[];
  /** Set only on an atom page: the ids of the atoms it depends on, already turned into links. */
  needs: { href: string; title: string }[];
  /** Every ref the site can resolve, so a link never renders as a dead label. */
  links: LinkTable;
  /** The atoms declared inside `blocks`, mapped to their own pages. */
  atomHrefs: Record<string, string>;
  /** The same page in the other locale, for the language toggle. */
  altHref: string;
};

/** Re-exported from refs.ts, where it lives because it is a ref→URL table and refs.ts is the file
 *  that owns turning a ref into a URL. */
export type { LinkTable };

export async function topicPaths(locale: Locale) {
  const { topics, atoms } = await records();
  return topicRoutes({ topics, atoms }, locale).map((route) => ({
    params: { slug: route.slug },
    props: { route },
  }));
}

export async function topicContent(route: TopicRoute): Promise<TopicContent> {
  const { topics, atoms } = await records();
  const links = linkTable(topics, atoms, route.locale);
  const other = otherLocale(route.locale);

  if (route.kind === "atom") {
    const atom = byId(atoms, route.entryId);
    return {
      route,
      title: atom.title,
      summary: "",
      blocks: atom.blocks,
      needs: atom.needs.map((need) => links[need]).filter(Boolean),
      links,
      atomHrefs: {},
      altHref: atomHref(route.topic, route.atomId ?? "", other),
    };
  }

  const topic = byId(topics, route.entryId);
  return {
    route,
    title: topic.title,
    summary: topic.summary,
    blocks: topic.blocks,
    needs: [],
    links,
    atomHrefs: Object.fromEntries(
      atoms
        .filter((a) => a.topic === route.topic)
        .map((a) => [a.localId, atomHref(a.topic, a.localId, route.locale)]),
    ),
    altHref: topicHref(route.topic, route.level, other),
  };
}

/**
 * The same document, cut down to what one peek panel needs.
 *
 * Thin on purpose: the projection is pure and lives in src/lib/peek.ts, so it can be tested — and
 * imported by the browser — without an Astro runtime. This function is only the half that reaches
 * the collections.
 */
export async function peekDoc(route: TopicRoute): Promise<PeekDoc> {
  const content = await topicContent(route);
  const ref = refOf(route);
  return projectPeek(content, allRefsIn(content.blocks), {
    ref,
    href: refHref(
      route.kind === "atom"
        ? { kind: "atom", topic: route.topic, atomId: route.atomId ?? "" }
        : { kind: "level", topic: route.topic, level: route.level, anchor: null },
      route.locale,
    ),
  });
}

/** A route's own ref — `entryId` minus the language it was resolved to. */
const refOf = (route: TopicRoute): string =>
  route.kind === "atom" ? `${route.topic}/${route.atomId}` : `${route.topic}/${route.level}`;

/* ———————————————————————————— internals ———————————————————————————— */

/**
 * Every record, read once.
 *
 * Two routes now ask for the same content — the page and its peek JSON — so an unmemoised read
 * doubles `getCollection` across the whole build. The cache is PROD-only because there is nothing
 * here to invalidate it in dev: src/content.config.ts nulls its own cache from the file watcher,
 * and a stale copy behind that would make `astro dev` stop reflecting edits.
 */
let cachedRecords: Promise<{ topics: TopicRecord[]; atoms: AtomRecord[] }> | null = null;

async function records(): Promise<{ topics: TopicRecord[]; atoms: AtomRecord[] }> {
  if (cachedRecords) return cachedRecords;
  const read = Promise.all([getCollection("topics"), getCollection("atoms")]).then(
    ([topics, atoms]) => ({ topics: topics.map((e) => e.data), atoms: atoms.map((e) => e.data) }),
  );
  if (import.meta.env.PROD) cachedRecords = read;
  return read;
}

/**
 * Every ref → where it goes and what to call it.
 *
 * Built whole rather than per page: it is a few hundred entries, and it never reaches the browser
 * because the components that read it render statically — the peek ships only the slice its own
 * blocks can reach. The alternative, resolving refs lazily inside the renderer, would need the
 * collection at every nesting level of every block.
 *
 * Memoised per locale, PROD-only, for the same reason `records()` is.
 */
const cachedTables = new Map<Locale, LinkTable>();

function linkTable(topics: TopicRecord[], atoms: AtomRecord[], locale: Locale): LinkTable {
  const hit = cachedTables.get(locale);
  if (hit) return hit;

  const table: LinkTable = {};

  // The reader's language first, the default second, so a translation wins where it exists and
  // an untranslated ref still lands somewhere real.
  for (const lang of [DEFAULT_LOCALE, locale]) {
    for (const topic of topics.filter((t) => t.lang === lang)) {
      table[topic.ref] = { href: topicHref(topic.topic, topic.level, locale), title: topic.title };
    }
    for (const atom of atoms.filter((a) => a.lang === lang)) {
      table[atom.ref] = { href: atomHref(atom.topic, atom.localId, locale), title: atom.title };
    }
  }

  if (import.meta.env.PROD) cachedTables.set(locale, table);
  return table;
}

function byId<T extends { id: string }>(records: T[], id: string): T {
  const found = records.find((r) => r.id === id);
  // A route only exists because a record did, so this is a bug in topicRoutes, not bad content.
  if (!found) throw new Error(`la ruta apunta a "${id}", que no está en la colección`);
  return found;
}

const otherLocale = (locale: Locale): Locale => LOCALES.find((l) => l !== locale) ?? DEFAULT_LOCALE;

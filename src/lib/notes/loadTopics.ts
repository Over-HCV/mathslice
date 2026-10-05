/*
  loadTopics.ts — one pass over media/maths/, producing every record the site needs.

  media/maths/ IS the published source. There is no generated index file and no second copy in
  src/content/: the .md in git is the thing the editor opens, the thing a page renders, and the
  thing the atom index is derived from. A generated file would be a second source of truth that
  can go stale; a derived index cannot.

  Shape of the tree this reads:

    media/maths/<group>/<…>/<topic>/main.md      manifest — title, summary, draft, video outline
                                    02-know.md   the entry level (narrative)
                                    01-info.md   relations and graphs
                                    00-data.md   formal atoms

  A directory is a topic iff it holds a main.md. Everything else in the tree (CONTENT-FRAMEWORK.md,
  loose research notes) is invisible here on purpose — publishing is opt-in, and `draft` defaults
  to true so a stub cannot become a page by accident.

  Node-only: this runs inside the content loader at build time, never in a browser.
*/

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { DEFAULT_LOCALE, LEVELS, LEVEL_FILE, LOCALES, type Level, type Locale } from "@/i18n";
import { parseAttrs, type Attrs } from "./directives";
import { parseNote, type ParsedNote } from "./format";
import { childListsOf, isAtom, type AtomBlock, type AtomKind, type Block } from "./model";
import { allRefsIn, renderKindOf } from "./render";

/** Relative to the project root — the same path mathsTree.ts walks for the explorer. */
export const MATHS_DIR = "media/maths";
const MANIFEST_FILE = "main.md";

/** What a topic folder declares once, in main.md, and every level file inherits. */
export type TopicManifest = {
  /** Path under media/maths, e.g. "a-origins/00-axioms". Doubles as the topic's URL segment. */
  topic: string;
  group: string;
  /** The numeric prefix of each path segment, so topics sort correctly at any nesting depth. */
  order: number[];
  title: string;
  summary: string;
  draft: boolean;
  file: string;
};

/** One level file of one topic in one language — a page. */
export type TopicRecord = {
  /** "es/a-origins/00-axioms/know" — the collection key, unique across languages. */
  id: string;
  /** "a-origins/00-axioms/know" — what a ref points at. Refs never name a language: a note links
   *  to an idea, and the reader's locale decides which translation of it they get. */
  ref: string;
  topic: string;
  group: string;
  level: Level;
  lang: Locale;
  title: string;
  summary: string;
  draft: boolean;
  order: number[];
  blocks: Block[];
  /** Every pointer this file holds, block-level and inline, in reading order. */
  refs: string[];
  file: string;
};

/** One `:::atom{…}` — the smallest referenceable unit of the whole site. */
export type AtomRecord = {
  /** "es/a-origins/00-axioms/sistema-formal" — the collection key, unique across languages. */
  id: string;
  /** "a-origins/00-axioms/sistema-formal" — what a ref resolves to, in any language. */
  ref: string;
  localId: string;
  topic: string;
  level: Level;
  lang: Locale;
  kind: AtomKind;
  /** The kind as written, before the parser's fallback: validation needs the typo, not the
   *  recovery it degraded to. */
  declaredKind: string;
  /** Resolved to global ids, so a consumer never has to know which topic they came from. */
  needs: string[];
  title: string;
  blocks: Block[];
  /** Every error about this atom names this file and line. */
  source: { file: string; line: number };
};

export type TopicIndex = {
  manifests: TopicManifest[];
  topics: TopicRecord[];
  atoms: AtomRecord[];
};

export function loadTopicIndex(root: string = process.cwd()): TopicIndex {
  const base = resolve(root, MATHS_DIR);
  if (!existsSync(base)) return { manifests: [], topics: [], atoms: [] };

  const manifests = findTopics(base).map((dir) => readManifest(base, dir, root));
  const topics: TopicRecord[] = [];
  const atoms: AtomRecord[] = [];

  for (const manifest of manifests) {
    for (const lang of LOCALES) {
      for (const level of LEVELS) {
        const file = resolve(base, manifest.topic, levelFile(level, lang));
        if (!existsSync(file)) continue;

        const source = readFileSync(file, "utf8");
        const note = parseNote(source);
        const rel = reportPath(file);

        topics.push(toTopicRecord(manifest, level, lang, note, rel));
        atoms.push(...toAtomRecords(manifest, level, lang, note, source, rel));
      }
    }
  }

  return { manifests, topics, atoms };
}

/** Spanish keeps the plain filename; every other locale suffixes it (`00-data.en.md`), so an
 *  untranslated topic is a missing file rather than a duplicated tree. */
const levelFile = (level: Level, lang: Locale): string =>
  lang === DEFAULT_LOCALE ? LEVEL_FILE[level] : LEVEL_FILE[level].replace(/\.md$/, `.${lang}.md`);

/* ————————————————————————— Walking the tree ————————————————————————— */

/** A folder holding a main.md is a topic and is not descended into, so a topic can never contain
 *  another topic. */
function findTopics(dir: string): string[] {
  if (existsSync(join(dir, MANIFEST_FILE))) return [dir];
  return subdirs(dir).flatMap((child) => findTopics(join(dir, child)));
}

function subdirs(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((name) => !name.startsWith(".") && statSync(join(dir, name)).isDirectory())
      .sort();
  } catch {
    return [];
  }
}

/**
 * group and order are DERIVED from the path, never declared.
 *
 * The directory already says both — `a-origins/00-axioms` is group `a-origins`, order 0 — and a
 * frontmatter copy would be a second source of truth that drifts the first time a folder is
 * renamed. main.md declares only what the path cannot know: the human title, the summary, and
 * whether the topic is ready to publish.
 */
function readManifest(base: string, dir: string, root: string): TopicManifest {
  const file = join(dir, MANIFEST_FILE);
  const topic = relative(base, dir).split(/[\\/]/).join("/");
  const { frontmatter } = parseNote(readFileSync(file, "utf8"));

  return {
    topic,
    group: topic.split("/")[0],
    order: topic.split("/").map((segment) => Number(segment.match(/^(\d+)-/)?.[1] ?? 0)),
    title: text(frontmatter.title) || prettify(topic.split("/").pop() ?? topic),
    summary: text(frontmatter.summary),
    // Restrictive by default: media/maths is also video research, so a file that says nothing
    // about being ready is not ready.
    draft: frontmatter.draft !== false,
    file: reportPath(file),
  };
}

/**
 * Every path a record carries is relative to the PROCESS, not to the root that was scanned.
 *
 * These paths end up in build errors, so they have to be paths you can paste into an editor. For
 * a real build the two are the same thing; for a test scanning a fixture tree they are not, and
 * the process-relative one is the one that opens.
 */
const reportPath = (file: string): string => relative(process.cwd(), file);

function toTopicRecord(
  manifest: TopicManifest,
  level: Level,
  lang: Locale,
  note: ParsedNote,
  file: string,
): TopicRecord {
  const ref = `${manifest.topic}/${level}`;
  return {
    id: `${lang}/${ref}`,
    ref,
    topic: manifest.topic,
    group: manifest.group,
    level,
    lang,
    title: text(note.frontmatter.title) || manifest.title,
    summary: text(note.frontmatter.summary) || manifest.summary,
    draft: manifest.draft,
    order: manifest.order,
    blocks: note.doc.blocks,
    refs: allRefsIn(note.doc.blocks),
    file,
  };
}

/* ————————————————————————————— Atoms ————————————————————————————— */

function toAtomRecords(
  manifest: TopicManifest,
  level: Level,
  lang: Locale,
  note: ParsedNote,
  source: string,
  file: string,
): AtomRecord[] {
  const declarations = scanAtomDeclarations(source);

  return atomsInOrder(note.doc.blocks).map((block, n) => ({
    id: `${lang}/${manifest.topic}/${block.atomId}`,
    ref: `${manifest.topic}/${block.atomId}`,
    localId: block.atomId,
    topic: manifest.topic,
    level,
    lang,
    kind: block.kind,
    declaredKind: declarations[n]?.attrs.kind ?? "",
    needs: block.needs.map((need) => resolveNeed(manifest.topic, need)),
    title: atomTitle(block.label, block.blocks, block.atomId),
    blocks: block.blocks,
    source: { file, line: declarations[n]?.line ?? 1 },
  }));
}

/** Pre-order, which is the order the parser emitted them and therefore the order they appear in
 *  the file — that correspondence is what lets the line scan below zip onto this list. */
function atomsInOrder(blocks: Block[]): AtomBlock[] {
  const out: AtomBlock[] = [];
  for (const block of blocks) {
    if (isAtom(block)) out.push(block);
    for (const list of childListsOf(block)) out.push(...atomsInOrder(list));
  }
  return out;
}

/**
 * Line numbers, straight from the source.
 *
 * The block model deliberately carries no source positions — they would be one more thing the
 * editor has to keep true through every edit. Errors still have to point somewhere, so the lines
 * are recovered by a second, tiny scan. It skips fenced regions for the same reason the parser
 * checks fences first: a `:::atom{` inside a code sample is a code sample.
 */
function scanAtomDeclarations(source: string): { line: number; attrs: Attrs }[] {
  const out: { line: number; attrs: Attrs }[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let fence: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const ticks = lines[i].match(/^(`{3,})/)?.[1];
    if (fence) {
      if (ticks && ticks.length >= fence.length && !lines[i].slice(ticks.length).trim()) fence = null;
      continue;
    }
    if (ticks) {
      fence = ticks;
      continue;
    }
    const open = lines[i].match(/^:{3,}atom(?:\{(.*)\})?\s*$/);
    if (open) out.push({ line: i + 1, attrs: parseAttrs(open[1] ?? "") });
  }

  return out;
}

/** A bare `needs="fbf"` means "in this topic"; anything with a slash is already global. Local is
 *  the common case by far — an atom's prerequisites are almost always its neighbours. */
const resolveNeed = (topic: string, need: string): string =>
  need.includes("/") ? need : `${topic}/${need}`;

/** The label attribute wins; otherwise the atom names itself the way it was already written —
 *  a heading, or the bold lead-in that every definition in 00-data.md opens with. */
function atomTitle(label: string, blocks: Block[], fallback: string): string {
  if (label) return label;

  for (const block of blocks) {
    const rk = renderKindOf(block);
    if (rk.kind === "heading") return rk.text;
    if (rk.kind === "markdown") {
      const bold = rk.content.match(/^\s*\*\*(.+?)\*\*/);
      if (bold) return bold[1].replace(/[.:]$/, "");
      break; // Only the FIRST prose block can be the lead-in; further down it is body text.
    }
  }

  return prettify(fallback);
}

/* ———————————————————————————— Helpers ———————————————————————————— */

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

function prettify(name: string): string {
  return name
    .replace(/^\d+-/, "")
    .split("-")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

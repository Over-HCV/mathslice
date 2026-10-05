/*
  validate.ts — everything that must be true about the content tree, checked once at build.

  Two entry points, one implementation. The content loader calls assertTopicIndex() so a broken
  ref fails `astro build` and lights up the dev overlay; a Vitest case calls validateTopicIndex()
  on a hand-built index and gets the same answers in milliseconds instead of after a full build.

  Every message names a file and a line. An error that only says "unresolved ref" makes you grep
  58 topics for it, which is the same as not reporting it.

  Errors are fatal because each one is a page that would render wrong: a dangling ref is a dead
  link, a duplicate atom id is two pages fighting over one URL, a cycle in `needs` is a layout
  that never terminates. Warnings are for things that are legal but probably not intended.
*/

import { readFileSync } from "node:fs";

import { DEFAULT_LOCALE, type Locale } from "@/i18n";
import { ATOM_KINDS } from "./model";
import { atomSlug, parseRef, refTargetId, topicSlug } from "./refs";
import type { AtomRecord, TopicIndex, TopicRecord } from "./loadTopics";

export type Problem = { file: string; line: number; message: string };
export type Validation = { errors: Problem[]; warnings: Problem[] };

/** Atoms are the vocabulary of the lowest level. Declaring one in 01-info.md or 02-know.md means
 *  the same term is defined in two places the moment someone writes the real one. */
const ATOM_LEVEL = "data";

export function validateTopicIndex(index: TopicIndex): Validation {
  const errors: Problem[] = [];
  const warnings: Problem[] = [];

  const atoms = new ByLang<AtomRecord>(index.atoms);
  const levels = new ByLang(index.topics);
  const draftTopics = new Set(index.manifests.filter((m) => m.draft).map((m) => m.topic));

  for (const atom of index.atoms) {
    const at = atom.source;

    if (!(ATOM_KINDS as readonly string[]).includes(atom.declaredKind)) {
      errors.push({
        ...at,
        message: `el átomo "${atom.localId}" declara kind="${atom.declaredKind}"; los válidos son ${ATOM_KINDS.join(", ")}`,
      });
    }

    if (atom.level !== ATOM_LEVEL) {
      errors.push({
        ...at,
        message: `el átomo "${atom.localId}" está declarado en el nivel "${atom.level}"; los átomos viven en el nivel "${ATOM_LEVEL}"`,
      });
    }

    const previous = atoms.duplicate(atom);
    if (previous) {
      errors.push({
        ...at,
        message: `id de átomo duplicado "${atom.localId}"; ya declarado en ${previous.source.file}:${previous.source.line}`,
      });
    }
  }

  for (const atom of index.atoms) {
    for (const need of atom.needs) {
      if (atoms.find(atom.lang, need)) continue;
      errors.push({
        ...atom.source,
        message: `el átomo "${atom.localId}" necesita "${need}", que no existe`,
      });
    }
  }

  errors.push(...cycleErrors(index.atoms, atoms));
  errors.push(...slugCollisions(index));

  for (const topic of index.topics) {
    for (const raw of new Set(topic.refs)) {
      const problem = { file: topic.file, line: lineOf(topic, raw) };
      const ref = parseRef(raw);

      if (!ref) {
        errors.push({ ...problem, message: `ref malformada "${raw}"; se espera <tema>/<nivel|átomo>[#ancla]` });
        continue;
      }

      const target = refTargetId(ref);
      const found = ref.kind === "level" ? levels.find(topic.lang, target) : atoms.find(topic.lang, target);
      if (!found) {
        errors.push({ ...problem, message: `ref sin resolver "${raw}"` });
        continue;
      }

      // Legal, but the link lands on a page that is not published yet.
      if (draftTopics.has(ref.topic) && !topic.draft) {
        warnings.push({ ...problem, message: `"${raw}" apunta a "${ref.topic}", que sigue en borrador` });
      }
    }
  }

  return { errors, warnings };
}

export function assertTopicIndex(index: TopicIndex): Validation {
  const result = validateTopicIndex(index);
  if (result.errors.length) throw new Error(formatProblems(result.errors));
  return result;
}

export const formatProblems = (problems: Problem[]): string =>
  problems.map((p) => `${p.file}:${p.line} — ${p.message}`).join("\n");

/**
 * Records looked up by ref, one shelf per language, falling back to the default one.
 *
 * A ref names an idea, not a translation, so `<Atom ref="…/sistema-formal">` written in an English
 * page has to find the English atom if there is one and the Spanish atom otherwise. Keying on ref
 * alone would make the two translations of an atom collide; keying on language alone would make
 * every untranslated ref look broken.
 */
class ByLang<T extends { ref: string; lang: Locale }> {
  readonly #shelves = new Map<Locale, Map<string, T>>();

  constructor(records: T[]) {
    for (const record of records) {
      const shelf = this.#shelves.get(record.lang) ?? new Map<string, T>();
      // First declaration wins, so `duplicate()` can point at it.
      if (!shelf.has(record.ref)) shelf.set(record.ref, record);
      this.#shelves.set(record.lang, shelf);
    }
  }

  find(lang: Locale, ref: string): T | null {
    return this.#shelves.get(lang)?.get(ref) ?? this.#shelves.get(DEFAULT_LOCALE)?.get(ref) ?? null;
  }

  /** The record already holding this (language, ref), when it is not this one. */
  duplicate(record: T): T | null {
    const held = this.#shelves.get(record.lang)?.get(record.ref) ?? null;
    return held && held !== record ? held : null;
  }
}

/**
 * Two records that would be published at the same URL.
 *
 * Nothing about the two slug shapes keeps them apart on its own: an atom lives at
 * `<topic>/atomo/<id>`, so a topic folder literally named `atomo` puts its `informacion` page
 * exactly where atom `informacion` of the parent topic would go. Absurd, and therefore precisely
 * the kind of thing that gets discovered as one page mysteriously overwriting another.
 *
 * Same language only: two translations of one page share a slug on purpose. And two records with
 * the same REF are skipped: that is a duplicate id, which the check above already reports with a
 * better message, and saying it twice would only make the real collision harder to spot.
 */
function slugCollisions(index: TopicIndex): Problem[] {
  const out: Problem[] = [];
  const seen = new Map<string, { ref: string; at: Problem }>();

  const claim = (lang: Locale, ref: string, slug: string, at: Problem): void => {
    const key = `${lang}|${slug}`;
    const held = seen.get(key);
    if (!held) {
      seen.set(key, { ref, at });
      return;
    }
    if (held.ref === ref) return;
    out.push({ ...at, message: `${at.message}; ya la ocupa ${held.at.file}:${held.at.line}` });
  };

  for (const topic of index.topics) {
    const slug = topicSlug(topic.topic, topic.level);
    claim(topic.lang, topic.ref, slug, {
      file: topic.file,
      line: 1,
      message: `dos páginas comparten la ruta "${slug}"`,
    });
  }

  for (const atom of index.atoms) {
    claim(atom.lang, atom.ref, atomSlug(atom.topic, atom.localId), {
      ...atom.source,
      message: `el átomo "${atom.localId}" comparte ruta con otra página`,
    });
  }

  return out;
}

/**
 * Cycles in the `needs` graph, reported once each and named in full.
 *
 * This is the guard that lets every downstream consumer assume a DAG: KnowledgeGraph lays atoms
 * out in layers, and DerivationStepper walks justifications to the bottom. Both loop forever on a
 * cycle, and neither is the right place to discover one.
 */
function cycleErrors(records: AtomRecord[], atoms: ByLang<AtomRecord>): Problem[] {
  const out: Problem[] = [];
  const state = new Map<AtomRecord, "visiting" | "done">();
  const reported = new Set<string>();
  const stack: AtomRecord[] = [];

  const walk = (atom: AtomRecord): void => {
    const status = state.get(atom);
    if (status === "done") return;

    if (status === "visiting") {
      const cycle = stack.slice(stack.indexOf(atom)).concat(atom).map((a) => a.ref);
      const key = [...cycle].sort().join(">");
      if (!reported.has(key)) {
        reported.add(key);
        out.push({ ...atom.source, message: `ciclo en needs: ${cycle.join(" → ")}` });
      }
      return;
    }

    state.set(atom, "visiting");
    stack.push(atom);
    for (const need of atom.needs) {
      const next = atoms.find(atom.lang, need);
      if (next) walk(next);
    }
    stack.pop();
    state.set(atom, "done");
  };

  // Seeded from every atom, so a cycle that nothing else points into is still found.
  for (const atom of records) walk(atom);
  return out;
}

/**
 * Where a ref sits in its file.
 *
 * Refs are not blocks, so the model does not carry their position, and the file is read again
 * here rather than threaded through the index — which keeps validation's input a plain
 * TopicIndex a test can build by hand. A ref string is distinctive enough that the first line
 * containing it is the right one; a file that has since vanished costs the line, never the error.
 */
function lineOf(topic: TopicRecord, ref: string): number {
  try {
    const found = readFileSync(topic.file, "utf8").split("\n").findIndex((line) => line.includes(ref));
    return found === -1 ? 1 : found + 1;
  } catch {
    return 1;
  }
}

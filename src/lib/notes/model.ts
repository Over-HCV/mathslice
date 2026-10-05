/*
  model.ts — local store + RECURSIVE block model for Anotaciones. A document is a column (a list
  of blocks); a container block ("columns", "atom") holds N lists of blocks, each itself fully
  nestable. Every editor operation works on this tree via the pure helpers below. MVP persistence
  is localStorage; Supabase comes later. SSR-safe (guards localStorage).

  Published topic pages are the SAME model, parsed from a .md file instead of localStorage —
  see ./format.ts. That is why the markdown-native detectors at the bottom of this file matter:
  a block that is markdown all the way down round-trips to a file without a serializer having to
  be clever about it.
*/

import { rankByKeys } from "../fuzzy";
import { parseFenceInfo, type Attrs } from "./directives";

export type LeafType = "text" | "heading" | "latex" | "code" | "mafs" | "diagram";
/** Types offered in the slash menu (leaves + the structural containers). */
export type BlockType = LeafType | "columns" | "atom";

export type LeafBlock = { id: string; type: LeafType; content: string };
export type Column = { id: string; blocks: Block[] };
export type ColumnsBlock = { id: string; type: "columns"; columns: Column[]; widths: number[] };

/** The closed vocabulary of the Dato level. Anything outside it is an authoring error, not a
 *  new category — see media/maths/CONTENT-FRAMEWORK.md. */
export const ATOM_KINDS = ["definition", "axiom", "theorem", "lemma", "property", "notation", "example"] as const;
export type AtomKind = (typeof ATOM_KINDS)[number];

/**
 * One formal, individually referenceable unit: a definition, an axiom, a theorem.
 *
 * Unlike every other block, its `atomId` is **written by the author** and survives in the file.
 * That is the whole point — an atom is the thing other notes point at, so its identity cannot be
 * the random `uid()` that ordinary blocks get and lose on every reparse.
 */
export type AtomBlock = {
  id: string;
  type: "atom";
  atomId: string;
  kind: AtomKind;
  /** Local ids of the atoms this one presupposes. Resolved to global ids by the index. */
  needs: string[];
  /** Author-given title. Empty means "derive it from the body". */
  label: string;
  blocks: Block[];
};

export type Block = LeafBlock | ColumnsBlock | AtomBlock;
/** A block that holds other blocks. The only thing the tree helpers below treat specially. */
export type ContainerBlock = ColumnsBlock | AtomBlock;

export type NoteDoc = { id: string; title: string; blocks: Block[]; updatedAt: number };

export const isColumns = (b: Block): b is ColumnsBlock => b.type === "columns";
export const isAtom = (b: Block): b is AtomBlock => b.type === "atom";
export const isContainer = (b: Block): b is ContainerBlock => isColumns(b) || isAtom(b);
export const MAX_COLS = 6; // free-tier cap per columns block (more = Pro)

const KEY = "mathslice-notes";
export const uid = () => Math.random().toString(36).slice(2, 10);

export const emptyTextBlock = (): LeafBlock => ({ id: uid(), type: "text", content: "" });

export function makeColumns(n = 2): ColumnsBlock {
  return {
    id: uid(),
    type: "columns",
    columns: Array.from({ length: n }, () => ({ id: uid(), blocks: [emptyTextBlock()] })),
    widths: Array(n).fill(1),
  };
}

export function makeAtom(atomId: string, kind: AtomKind = "definition"): AtomBlock {
  return { id: uid(), type: "atom", atomId, kind, needs: [], label: "", blocks: [emptyTextBlock()] };
}

/* ————————————————————————— Tree helpers (pure) ————————————————————————— */

export const cloneTree = (blocks: Block[]): Block[] => structuredClone(blocks);

/**
 * Every list of blocks a container holds, in reading order — `[]` for a leaf.
 *
 * This pair is the only place in the file that knows what a container *is*. Every helper below
 * walks the tree through it, so adding the next container (a callout, an aside) costs two cases
 * here and nothing anywhere else. Before this existed, "columns" was spelled out in nine
 * separate recursions, which is nine places to forget the new one.
 */
export function childListsOf(b: Block): Block[][] {
  if (isColumns(b)) return b.columns.map((c) => c.blocks);
  if (isAtom(b)) return [b.blocks];
  return [];
}

/** Rebuild a container around new child lists, positionally. Identity for a leaf. */
export function withChildLists(b: Block, lists: Block[][]): Block {
  if (isColumns(b)) return { ...b, columns: b.columns.map((c, i) => ({ ...c, blocks: lists[i] })) };
  if (isAtom(b)) return { ...b, blocks: lists[0] };
  return b;
}

/** Rebuild the spine, replacing block `id` with fn(block). Cheap enough for per-keystroke edits. */
export function updateBlock(list: Block[], id: string, fn: (b: Block) => Block): Block[] {
  return list.map((b) => {
    if (b.id === id) return fn(b);
    const lists = childListsOf(b);
    if (!lists.length) return b;
    return withChildLists(
      b,
      lists.map((l) => updateBlock(l, id, fn)),
    );
  });
}

/** Remove block `id` anywhere in the tree; never leaves a container (or the root) empty. */
export function removeBlock(list: Block[], id: string, isRoot = true): Block[] {
  const out: Block[] = [];
  for (const b of list) {
    if (b.id === id) continue;
    const lists = childListsOf(b);
    if (!lists.length) {
      out.push(b);
      continue;
    }
    // An empty column or atom body has nowhere to put the caret, so it always keeps one block.
    out.push(
      withChildLists(
        b,
        lists.map((l) => {
          const blocks = removeBlock(l, id, false);
          return blocks.length ? blocks : [emptyTextBlock()];
        }),
      ),
    );
  }
  return out.length || !isRoot ? out : [emptyTextBlock()];
}

/** Frames from the root down to block `id`; last frame is the block, parents are containers. */
export type Frame = { arr: Block[]; index: number; listIndex?: number };
export function pathTo(root: Block[], id: string, arr: Block[] = root): Frame[] | null {
  for (let i = 0; i < arr.length; i++) {
    const b = arr[i];
    if (b.id === id) return [{ arr, index: i }];
    const lists = childListsOf(b);
    for (let l = 0; l < lists.length; l++) {
      const sub = pathTo(root, id, lists[l]);
      if (sub) return [{ arr, index: i, listIndex: l }, ...sub];
    }
  }
  return null;
}

/** Insert `nb` right after block `id`, in the same column. Returns a new tree. */
export function insertAfter(root: Block[], id: string, nb: Block): Block[] {
  const clone = cloneTree(root);
  const path = pathTo(clone, id);
  if (!path) return root;
  const f = path[path.length - 1];
  f.arr.splice(f.index + 1, 0, nb);
  return clone;
}

/** Swap block `id` with its neighbour in the same column (Alt+↑/↓). */
export function moveWithinColumn(root: Block[], id: string, dir: -1 | 1): Block[] {
  const clone = cloneTree(root);
  const path = pathTo(clone, id);
  if (!path) return root;
  const f = path[path.length - 1];
  const j = f.index + dir;
  if (j < 0 || j >= f.arr.length) return root;
  [f.arr[f.index], f.arr[j]] = [f.arr[j], f.arr[f.index]];
  return clone;
}

/** True if `tid` is `node` itself or lives anywhere beneath it. */
export function contains(node: Block, tid: string): boolean {
  return node.id === tid || childListsOf(node).some((l) => l.some((b) => contains(b, tid)));
}

/** Detach block `id` from wherever it lives and re-insert it immediately before/after `targetId`
 *  (which may sit in a different container). No-op if id === targetId, if targetId can't be found
 *  after detaching, or if `targetId` is inside `id`'s own subtree (would create a cycle).
 *  Never leaves a container empty (mirrors removeBlock). */
export function moveBlockNextTo(root: Block[], id: string, targetId: string, place: "before" | "after"): Block[] {
  if (id === targetId) return root;
  const clone = cloneTree(root);

  let moving: Block | null = null;
  const detach = (list: Block[]): Block[] => {
    const out: Block[] = [];
    for (const b of list) {
      if (b.id === id) {
        moving = b;
        continue;
      }
      const lists = childListsOf(b);
      out.push(lists.length ? withChildLists(b, lists.map(detach)) : b);
    }
    return out;
  };
  const withoutMoving = detach(clone);
  if (!moving) return root;
  if (contains(moving, targetId)) return root;

  const path = pathTo(withoutMoving, targetId);
  if (!path) return root;
  const f = path[path.length - 1];
  f.arr.splice(f.index + (place === "after" ? 1 : 0), 0, moving);

  const fillEmpty = (list: Block[]): Block[] =>
    list.map((b) => {
      const lists = childListsOf(b);
      if (!lists.length) return b;
      return withChildLists(
        b,
        lists.map((l) => (l.length ? fillEmpty(l) : [emptyTextBlock()])),
      );
    });
  return fillEmpty(withoutMoving);
}

/** Leaf ids in reading order (containers expand list by list) — for selection stepping. */
export function flattenVisual(list: Block[]): string[] {
  const out: string[] = [];
  for (const b of list) {
    const lists = childListsOf(b);
    if (!lists.length) out.push(b.id);
    else for (const l of lists) out.push(...flattenVisual(l));
  }
  return out;
}

/** First/last leaf id reached by descending into a container. */
export function edgeLeaf(cb: ContainerBlock, from: "top" | "bottom"): string {
  const list = childListsOf(cb)[0];
  const b = from === "top" ? list[0] : list[list.length - 1];
  return isContainer(b) ? edgeLeaf(b, from) : b.id;
}

/* ————————————————————————————— Store ————————————————————————————— */

function normalize(blocks: Block[]): Block[] {
  // Migrate old dedicated code/latex blocks + markdown-per-column columns to the current model.
  return blocks.map((b) => {
    if (b.type === "code") {
      const raw = (b as unknown as { content: string }).content ?? "";
      try {
        const p = JSON.parse(raw);
        return { id: b.id, type: "text", content: wrapFence(p.lang === "py" ? "py" : "js", p.code ?? "") };
      } catch {
        return { id: b.id, type: "text", content: wrapFence("js", raw) };
      }
    }
    if (b.type === "latex") {
      const raw = (b as unknown as { content: string }).content ?? "";
      return { id: b.id, type: "text", content: `$$${raw}$$` };
    }
    if (b.type === "columns" && !Array.isArray((b as ColumnsBlock).columns)) {
      try {
        const old = JSON.parse((b as unknown as { content: string }).content);
        if (Array.isArray(old?.cols)) {
          return {
            id: b.id,
            type: "columns",
            columns: old.cols.map((c: string) => ({
              id: uid(),
              blocks: [{ id: uid(), type: "text", content: c || "" } as LeafBlock],
            })),
            widths: old.w ?? old.cols.map(() => 1),
          } as ColumnsBlock;
        }
      } catch {
        /* fall through */
      }
      return makeColumns(2);
    }
    const lists = childListsOf(b);
    if (lists.length) return withChildLists(b, lists.map(normalize));
    return b;
  });
}

function readAll(): NoteDoc[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as NoteDoc[]) : [];
  } catch {
    return [];
  }
}
function writeAll(docs: NoteDoc[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(docs));
  } catch {
    /* ignore quota / private mode */
  }
}

export function listDocs(): NoteDoc[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}
export function getDoc(id: string): NoteDoc | null {
  const d = readAll().find((x) => x.id === id);
  return d ? { ...d, blocks: normalize(d.blocks) } : null;
}
export function saveDoc(doc: NoteDoc) {
  const docs = readAll();
  const i = docs.findIndex((d) => d.id === doc.id);
  const next = { ...doc, updatedAt: Date.now() };
  if (i >= 0) docs[i] = next;
  else docs.push(next);
  writeAll(docs);
}
export function deleteDoc(id: string) {
  writeAll(readAll().filter((d) => d.id !== id));
}
export function createDoc(title: string): NoteDoc {
  const doc: NoteDoc = { id: uid(), title, blocks: [emptyTextBlock()], updatedAt: Date.now() };
  saveDoc(doc);
  return doc;
}

/* Count leaf blocks for the doc-list card. */
export function countLeaves(blocks: Block[]): number {
  return flattenVisual(blocks).length;
}

/* ————————————————————————— Slash menu ————————————————————————— */

export const BLOCK_DEFS: { type: BlockType; label: string; keys: string[] }[] = [
  { type: "text", label: "Texto", keys: ["texto", "text", "parrafo", "p"] },
  { type: "heading", label: "Encabezado", keys: ["encabezado", "heading", "titulo", "h", "h2"] },
  { type: "latex", label: "Ecuación", keys: ["latex", "ltx", "math", "matematica", "ecuacion", "tex"] },
  { type: "code", label: "Código", keys: ["codigo", "code", "js", "py", "python", "ejecutable"] },
  { type: "mafs", label: "Gráfica", keys: ["grafica", "graph", "plot", "funcion", "mafs", "curva"] },
  { type: "diagram", label: "Diagrama", keys: ["diagrama", "diagram", "grafo", "nodos", "red"] },
  { type: "columns", label: "Columnas", keys: ["columnas", "columns", "col", "cols", "layout"] },
];

/** Fuzzy-rank block types for a slash query. Empty on a typo — the caller decides what to show. */
export function fuzzyBlocks(query: string): typeof BLOCK_DEFS {
  return rankByKeys(query, BLOCK_DEFS, (d) => [d.label, ...d.keys]);
}

/* ————————————————— Markdown-native code/math detection (export-friendly) —————————————————
   A text block whose content is a single fenced code block renders as a code block; if the fence
   language is runnable it executes, otherwise it's shown statically. `$$…$$` renders as an
   equation (the markdown pipeline already handles that). Storing everything as markdown means a
   document round-trips to a plain .md/.mdx on export. */

/**
 * A text block that is entirely one fenced code block.
 *
 * The info string is the language plus optional `key="value"` attributes, so a fence can say what
 * it is *about* (` ```lean theorem="…" `) without that becoming a new block type. Attributes are
 * empty for the overwhelming majority of fences, which is why they stay out of the way here.
 */
export function detectFence(content: string): { lang: string; attrs: Attrs; code: string } | null {
  const m = content.match(/^```([^\n]*)\n?([\s\S]*?)\n?```$/);
  if (!m) return null;
  const { lang, attrs } = parseFenceInfo(m[1]);
  return { lang, attrs, code: m[2] };
}

/** The line break inside display maths. Two characters in the content: `\` and `\`. */
const MATH_SEPARATOR = "\\\\";

export type MathBlock = {
  /** One per line, trimmed. Blank lines survive as `""` — they are the author's spacing. */
  lines: string[];
  /** Where each line starts in the RAW content, same indices as `lines`. */
  offsets: number[];
};

/**
 * A text block that is entirely `$$…$$`, split into the lines the engine can be pointed at.
 *
 * Mirrors detectFence: it recognises the *shape* and does not read the maths. Whether a given line
 * is solvable is the engine's call (`probe` in lib/engine/runner.ts), not a regex's — a block is a
 * notebook, and the lines above the last one are usually the working, not the query.
 *
 * **Lines are separated by `\\`**, which is the line break of display maths: what a `$$` block
 * holds is then one LaTeX document that KaTeX renders in rows, and the engine gets each row on its
 * own. A raw newline still splits, because that is how every note written before this did it and
 * how anyone editing the markdown by hand will keep doing it — but `\\` wins where both appear.
 *
 * `offsets` comes out of the same walk that produces `lines`: it is where the caret goes when the
 * reader clicks a rendered line to edit it. The two used to be computed by separate functions from
 * separate assumptions about where the `$$` sits, which is exactly how the caret ends up one
 * character off in the case nobody tried.
 */
export function detectMath(content: string): MathBlock | null {
  const m = content.trim().match(/^\$\$([\s\S]*?)\$\$$/);
  if (!m) return null;

  const body = m[1];
  const separator = body.includes(MATH_SEPARATOR) ? MATH_SEPARATOR : "\n";
  const leading = content.length - content.trimStart().length;

  const lines: string[] = [];
  const offsets: number[] = [];
  let cursor = leading + "$$".length;

  for (const raw of body.split(separator)) {
    // The caret goes where the maths starts, not where the padding around it does.
    const indent = raw.length - raw.trimStart().length;
    lines.push(raw.trim());
    offsets.push(Math.min(cursor + indent, content.length));
    cursor += raw.length + separator.length;
  }

  return { lines, offsets };
}

/**
 * The canonical `$$…$$` for a set of lines — what the maths editor writes back.
 *
 * One line stays on one line, so a single equation reads as `$$x+1$$` in the exported markdown.
 * Blank lines are dropped here and not in `detectMath`: an empty row is something the editor shows
 * while you are in it, not something worth writing down.
 */
export function writeMathBlock(lines: string[]): string {
  const written = lines.map((line) => line.trim()).filter(Boolean);
  return `$$${written.join(` ${MATH_SEPARATOR} `)}$$`;
}

/** Returns the runner id for a runnable language, or null (render statically). */
export function runnableLang(lang: string): "js" | "py" | null {
  if (lang === "js" || lang === "javascript" || lang === "node") return "js";
  if (lang === "py" || lang === "python") return "py";
  return null;
}

export const wrapFence = (lang: string, code: string) => "```" + lang + "\n" + code + "\n```";
export const MATH_SEED = "$$\n\n$$";

/** Placeholder content for a newly created LEAF block (columns use makeColumns instead). */
export function seedContent(type: LeafType): string {
  switch (type) {
    case "heading":
      // `##`, not `#`: headings now render at the level they are written, and the page's own title
      // is the h1. A block heading is a section inside the document, never the document.
      return "## Título";
    case "latex":
      return "e^{i\\pi} + 1 = 0";
    case "code":
      return JSON.stringify({ lang: "js", code: "console.log('hola desde el sandbox');" });
    case "mafs":
      return "y=\\sin(x)";
    default:
      return "";
  }
}

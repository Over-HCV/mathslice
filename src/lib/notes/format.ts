/*
  format.ts — the .md ⇄ NoteDoc round-trip. This is the file that makes a published topic page
  and an editable note the same object.

  THE ONE IDEA: the parser never re-renders prose. It segments the file into blocks and stores
  each block's source slice VERBATIM. Losslessness is therefore a property of the design, not
  something a careful serialiser has to keep earning. This is why we do not run the file through
  remark: any AST round-trip normalises emphasis markers, list bullets, table padding and escapes,
  so every save would rewrite prose the author typed by hand.

  Two laws, both tested in ./format.test.ts:
    1. serializeNote(parseNote(f)) === f    for every tracked note file (CI gate: files stay canonical)
    2. parseNote(serializeNote(doc)).doc ≡ doc   modulo ids, for any doc the editor can build

  The single lossy point is that runs of blank lines between top-level blocks collapse to one.
  Law 1 pins it: normalise the files once and it can never drift again.

  THE PARSER NEVER THROWS. Anything it does not recognise becomes a verbatim text block. Worst
  case a construct renders as prose; it can never vanish. A parser that throws on a file it does
  not understand is a parser that loses that file.
*/

import { parse as parseYaml } from "yaml";

import {
  emptyTextBlock,
  uid,
  type AtomKind,
  type Block,
  type ColumnsBlock,
  type LeafBlock,
  type LeafType,
  ATOM_KINDS,
  isAtom,
  isColumns,
} from "./model";
import { parseAttrs, parseList, writeAttrs } from "./directives";

export type NoteFrontmatter = Record<string, unknown>;
export type ParsedNote = {
  /** Parsed for reading. */
  frontmatter: NoteFrontmatter;
  /** The frontmatter's source, kept so serialising re-emits it byte-for-byte rather than
   *  re-encoding YAML (which would reflow quotes, block scalars and key order). */
  frontmatterSource: string;
  doc: NoteDocBody;
};
export type NoteDocBody = { title: string; blocks: Block[] };

/** Fence languages the model already has a first-class, editable block type for. Every other
 *  fence — including the artifact ones — stays a verbatim text block, because there is no
 *  editing UI that would benefit from unwrapping it and unwrapping loses the info string. */
const FENCE_TYPE: Record<string, LeafType> = { mafs: "mafs", diagram: "diagram" };

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const FENCE_OPEN = /^(`{3,})(.*)$/;
const DIRECTIVE_OPEN = /^(:{3,})([a-zA-Z][\w-]*)(?:\[([^\]]*)\])?(?:\{(.*)\})?\s*$/;
const HEADING = /^#{1,6}\s/;
const MATH_OPEN = /^\$\$/;

/* ————————————————————————————— Parsing ————————————————————————————— */

export function parseNote(md: string): ParsedNote {
  const fm = md.match(FRONTMATTER);
  const frontmatterSource = fm ? fm[1] : "";
  const body = fm ? md.slice(fm[0].length) : md;

  let frontmatter: NoteFrontmatter = {};
  if (frontmatterSource) {
    try {
      frontmatter = (parseYaml(frontmatterSource) as NoteFrontmatter) ?? {};
    } catch {
      // Malformed YAML is an authoring error the loader reports with a file:line. It must not
      // cost us the body, which is where all the work is.
      frontmatter = {};
    }
  }

  const blocks = parseBlocks(splitLines(body));
  return {
    frontmatter,
    frontmatterSource,
    doc: { title: typeof frontmatter.title === "string" ? frontmatter.title : "", blocks },
  };
}

const splitLines = (s: string): string[] => s.replace(/\r\n/g, "\n").split("\n");

/**
 * One pass over a list of lines, emitting one block per recognised construct.
 *
 * Order matters: fences are checked before everything else because a fence body is opaque and may
 * legitimately contain `:::`, `$$` or `#` that must not be read as structure.
 */
function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    if (!lines[i].trim()) {
      i++;
      continue;
    }

    const fence = lines[i].match(FENCE_OPEN);
    if (fence) {
      const end = findFenceEnd(lines, i, fence[1]);
      blocks.push(fenceBlock(lines.slice(i, end + 1).join("\n"), fence[2]));
      i = end + 1;
      continue;
    }

    const directive = lines[i].match(DIRECTIVE_OPEN);
    if (directive && directive[2] !== "embed") {
      const end = findDirectiveEnd(lines, i, directive[1].length);
      const inner = lines.slice(i + 1, end);
      const block = directiveBlock(directive[2], directive[4] ?? "", inner);
      // An unknown directive name is not structure we understand; keep its source rather than
      // guess at it.
      blocks.push(block ?? textBlock(lines.slice(i, end + 1).join("\n")));
      i = end + 1;
      continue;
    }

    if (MATH_OPEN.test(lines[i].trim())) {
      const end = findMathEnd(lines, i);
      blocks.push(textBlock(lines.slice(i, end + 1).join("\n")));
      i = end + 1;
      continue;
    }

    if (HEADING.test(lines[i])) {
      blocks.push({ id: uid(), type: "heading", content: lines[i] });
      i++;
      continue;
    }

    const end = findParagraphEnd(lines, i);
    blocks.push(textBlock(lines.slice(i, end).join("\n")));
    i = end;
  }

  return blocks.length ? blocks : [emptyTextBlock()];
}

/** The line index of the fence's closing delimiter, or the last line if it never closes. */
function findFenceEnd(lines: string[], open: number, ticks: string): number {
  const close = new RegExp(`^\`{${ticks.length},}\\s*$`);
  for (let i = open + 1; i < lines.length; i++) if (close.test(lines[i])) return i;
  return lines.length - 1;
}

/** The line index of the directive's closing colons. Inner directives use FEWER colons than their
 *  container, so a line of exactly `depth` colons can only be our own closer. */
function findDirectiveEnd(lines: string[], open: number, depth: number): number {
  const close = new RegExp(`^:{${depth}}\\s*$`);
  for (let i = open + 1; i < lines.length; i++) if (close.test(lines[i])) return i;
  return lines.length - 1;
}

/** `$$` on its own line opens a display-maths block that ends at the next `$$`. A one-line
 *  `$$x+1$$` closes on the line it opened. */
function findMathEnd(lines: string[], open: number): number {
  const first = lines[open].trim();
  if (first.length > 2 && first.endsWith("$$")) return open;
  for (let i = open + 1; i < lines.length; i++) if (lines[i].trim().endsWith("$$")) return i;
  return lines.length - 1;
}

/** Prose runs to the next blank line. A heading or a fence also ends it: markdown does not need a
 *  blank line before either, and swallowing one into a paragraph would change what it renders as. */
function findParagraphEnd(lines: string[], start: number): number {
  let i = start + 1;
  while (i < lines.length && lines[i].trim() && !HEADING.test(lines[i]) && !FENCE_OPEN.test(lines[i])) i++;
  return i;
}

const textBlock = (content: string): LeafBlock => ({ id: uid(), type: "text", content });

function fenceBlock(source: string, info: string): LeafBlock {
  const lang = info.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const type = FENCE_TYPE[lang];
  if (!type) return textBlock(source);
  // Unwrap: the editor edits the expression, not the fence around it.
  const body = source.split("\n").slice(1, -1).join("\n");
  return { id: uid(), type, content: body };
}

function directiveBlock(name: string, attrSource: string, inner: string[]): Block | null {
  const attrs = parseAttrs(attrSource);
  if (name === "atom") {
    const atomId = attrs.id;
    if (!atomId) return null;
    const kind = attrs.kind as AtomKind;
    return {
      id: uid(),
      type: "atom",
      atomId,
      // An unknown kind is reported by the atom index with a file:line; here it degrades to the
      // commonest one so the block still renders while you fix it.
      kind: (ATOM_KINDS as readonly string[]).includes(kind) ? kind : "definition",
      needs: parseList(attrs.needs),
      label: attrs.label ?? "",
      blocks: parseBlocks(inner),
    };
  }
  if (name === "columns") return columnsDirective(attrs, inner);
  return null;
}

function columnsDirective(attrs: Record<string, string>, inner: string[]): ColumnsBlock | null {
  const cols: string[][] = [];
  let i = 0;
  while (i < inner.length) {
    const open = inner[i].match(DIRECTIVE_OPEN);
    if (!open || open[2] !== "col") {
      i++;
      continue;
    }
    const end = findDirectiveEnd(inner, i, open[1].length);
    cols.push(inner.slice(i + 1, end));
    i = end + 1;
  }
  if (!cols.length) return null;

  const widths = parseList(attrs.widths).map(Number);
  return {
    id: uid(),
    type: "columns",
    columns: cols.map((lines) => ({ id: uid(), blocks: parseBlocks(lines) })),
    widths: cols.map((_, n) => (Number.isFinite(widths[n]) && widths[n] > 0 ? widths[n] : 1)),
  };
}

/* ——————————————————————————— Serialising ——————————————————————————— */

export function serializeNote(note: ParsedNote): string {
  const head = note.frontmatterSource ? `---\n${note.frontmatterSource}\n---\n\n` : "";
  return head + writeBlocks(note.doc.blocks) + "\n";
}

const writeBlocks = (blocks: Block[]): string => blocks.map(writeBlock).join("\n\n");

function writeBlock(block: Block): string {
  if (isColumns(block)) {
    const depth = markerDepth(block);
    const inner = block.columns
      .map((c) => `${":".repeat(depth - 1)}col\n${writeBlocks(c.blocks)}\n${":".repeat(depth - 1)}`)
      .join("\n");
    return `${":".repeat(depth)}columns{${writeAttrs({ widths: block.widths.join(",") })}}\n${inner}\n${":".repeat(depth)}`;
  }

  if (isAtom(block)) {
    const depth = markerDepth(block);
    const attrs: Record<string, string> = { id: block.atomId, kind: block.kind };
    if (block.needs.length) attrs.needs = block.needs.join(",");
    if (block.label) attrs.label = block.label;
    const open = `${":".repeat(depth)}atom{${writeAttrs(attrs)}}`;
    return `${open}\n${writeBlocks(block.blocks)}\n${":".repeat(depth)}`;
  }

  const type = block.type;
  if (type === "mafs" || type === "diagram") return "```" + type + "\n" + block.content + "\n```";
  return block.content;
}

/**
 * How many colons a container's delimiter needs.
 *
 * A directive is closed by a line of exactly its own colon count, so a container must use MORE
 * colons than anything nested inside it — otherwise the inner closer would end the outer block.
 * Columns add two levels at once because each column is itself a `:::col` directive.
 */
function markerDepth(block: Block): number {
  const inner = (isColumns(block) ? block.columns.flatMap((c) => c.blocks) : isAtom(block) ? block.blocks : []).map(
    (b) => (isColumns(b) || isAtom(b) ? markerDepth(b) : 0),
  );
  const deepest = Math.max(0, ...inner);
  return isColumns(block) ? Math.max(4, deepest + 2) : Math.max(3, deepest + 1);
}

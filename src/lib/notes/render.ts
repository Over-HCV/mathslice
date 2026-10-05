/*
  render.ts — the ONE dispatch table: block → what to draw. Pure, no JSX, no React, no Astro.

  Two hosts consume it and there is no third:
    src/components/topic/BlockRenderer.astro   the published page (static-first, zero JS where it can)
    src/components/notes/render/BlockView.tsx  the editor's read mode AND the peek panel

  Two hosts, ONE table. That is the point. Before this file existed the decision lived inside
  LeafRow, so a published page could only ever be a second implementation of it, drifting one
  branch at a time. If you find yourself adding a `if (block.type === …)` to either host, it
  belongs here instead.

  The table describes READ mode only. Edit mode is the editor's business and always will be.
*/

import { detectAtomRef, detectEmbed, inlineRefsIn, isArtifactLang, type ArtifactName } from "./directives";
import { detectFence, detectMath, isAtom, isColumns, runnableLang, type AtomKind, type Block } from "./model";
import { headingLevel, headingText, slugify } from "./slug";

export type RenderKind =
  | { kind: "markdown"; content: string }
  | { kind: "heading"; level: number; text: string; anchor: string }
  | { kind: "math"; lines: string[]; offsets: number[] }
  | { kind: "code"; lang: string; code: string; runnable: "js" | "py" | null }
  | { kind: "lean"; code: string; theorem: string | null }
  | { kind: "mafs"; expr: string }
  | { kind: "artifact"; name: ArtifactName; props: unknown; error: string | null }
  | { kind: "embed"; ref: string; label: string }
  | { kind: "atomref"; ref: string; label: string }
  | { kind: "columns"; columns: Block[][]; widths: number[] }
  | { kind: "atom"; atomId: string; atomKind: AtomKind; needs: string[]; label: string; blocks: Block[] };

/** Fallback expression for a graph block saved empty — mirrors seedContent("mafs"). */
const MAFS_FALLBACK = "y=\\sin(x)";

/**
 * What to draw for one block.
 *
 * Order is load-bearing. A fence body is opaque, so it is checked before `$$` and before the
 * directives: a `js` fence that happens to contain `$$x$$` is code, not maths, and reading it the
 * other way round is how a code sample silently becomes an equation.
 */
export function renderKindOf(block: Block): RenderKind {
  if (isColumns(block)) {
    return { kind: "columns", columns: block.columns.map((c) => c.blocks), widths: block.widths };
  }
  if (isAtom(block)) {
    return {
      kind: "atom",
      atomId: block.atomId,
      atomKind: block.kind,
      needs: block.needs,
      label: block.label,
      blocks: block.blocks,
    };
  }
  if (block.type === "diagram") return artifactKind("diagram", block.content);
  if (block.type === "mafs") return { kind: "mafs", expr: block.content.trim() || MAFS_FALLBACK };
  if (block.type === "heading") {
    const text = headingText(block.content);
    return { kind: "heading", level: headingLevel(block.content), text, anchor: slugify(text) };
  }

  const fence = detectFence(block.content);
  if (fence) {
    if (isArtifactLang(fence.lang)) return artifactKind(fence.lang, fence.code);
    if (fence.lang === "lean") return { kind: "lean", code: fence.code, theorem: fence.attrs.theorem ?? null };
    return {
      kind: "code",
      lang: fence.lang,
      code: fence.code,
      runnable: runnableLang(fence.lang),
    };
  }

  const math = detectMath(block.content);
  if (math) return { kind: "math", lines: math.lines, offsets: math.offsets };

  const embed = detectEmbed(block.content);
  if (embed) return { kind: "embed", ...embed };

  const atomRef = detectAtomRef(block.content);
  if (atomRef) return { kind: "atomref", ...atomRef };

  return { kind: "markdown", content: block.content };
}

/**
 * Parse an artifact's JSON here rather than inside each artifact, so both hosts get the same
 * answer to "is this authorable JSON or a typo" and neither has to throw to say so. An empty body
 * is legitimate: it means "use your defaults", which is how NodeDiagram has always worked.
 */
function artifactKind(name: ArtifactName, source: string): RenderKind {
  const body = source.trim();
  if (!body) return { kind: "artifact", name, props: null, error: null };
  try {
    return { kind: "artifact", name, props: JSON.parse(body), error: null };
  } catch (e) {
    return { kind: "artifact", name, props: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Every ref a document points at, in reading order — what the build validates and what the
 *  embed-cycle check walks. Refs are opaque strings here; resolving them is the index's job. */
export function refsIn(blocks: Block[]): string[] {
  const out: string[] = [];
  for (const block of blocks) {
    const rk = renderKindOf(block);
    if (rk.kind === "embed" || rk.kind === "atomref") out.push(rk.ref);
    else if (rk.kind === "columns") for (const c of rk.columns) out.push(...refsIn(c));
    else if (rk.kind === "atom") out.push(...refsIn(rk.blocks));
    // Inline <Atom> refs live inside prose and are invisible here; allRefsIn() adds them.
  }
  return out;
}

/** The `<Atom ref>` pointers buried inside prose — invisible to refsIn(), because they live in a
 *  markdown string rather than in the block tree. */
function proseRefsIn(blocks: Block[]): string[] {
  const out: string[] = [];
  for (const block of blocks) {
    const rk = renderKindOf(block);
    if (rk.kind === "markdown") out.push(...inlineRefsIn(rk.content));
    else if (rk.kind === "heading") out.push(...inlineRefsIn(rk.text));
    else if (rk.kind === "columns") for (const c of rk.columns) out.push(...proseRefsIn(c));
    else if (rk.kind === "atom") out.push(...proseRefsIn(rk.blocks));
  }
  return out;
}

/**
 * EVERY pointer a block tree holds, block-level and inline.
 *
 * Three consumers need exactly this set and must never see different ones: the atom index (what
 * the build validates), the embed-cycle walk, and the peek payload (which ships only the links its
 * blocks can reach). Two of them used to compute it separately.
 */
export function allRefsIn(blocks: Block[]): string[] {
  return [...refsIn(blocks), ...proseRefsIn(blocks)];
}

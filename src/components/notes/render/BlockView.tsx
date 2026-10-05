/*
  BlockView — READ mode for a block tree, in React.

  Three callers, deliberately:
    · the editor (NotesApp/LeafRow), for every block it is not currently editing
    · the peek panel, which renders a fetched document with no editor around it
    · nothing else — the published page uses the Astro host, which walks the SAME table

  What to draw is decided by `renderKindOf` in src/lib/notes/render.ts, never here. This file only
  wires each answer to a component. If you need a new branch, add it there first; a branch that
  exists only in this file is a branch the published page will not have.

  Every editor affordance arrives through `hooks` and every one of them is optional, so the default
  is a document you can read and not edit. That is what the peek and the page want, and it means
  neither can accidentally acquire half an editor.
*/

import { type MouseEvent as ReactMouseEvent } from "react";

import CodeRunner from "@/components/artifacts/CodeRunner";
import GraphBlock from "@/components/artifacts/GraphBlock";
import MathRunner from "@/components/artifacts/MathRunner";
import NodeDiagram from "@/components/artifacts/NodeDiagram";
import { renderKindOf } from "@/lib/notes/render";
import type { AtomKind, Block } from "@/lib/notes/model";
import { ArtifactError, AtomShell, Heading, LeanBlock, Prose, RefCard, type RefResolver } from "./pieces";

/** Where the caret goes in the block's SOURCE markdown. `"end"` when the click cannot be mapped. */
export type SourceCaret = number | "end";

export type BlockViewHooks = {
  /**
   * "Put me in edit mode, caret here."
   *
   * One hook for every way of entering edit mode — clicking prose, clicking a rendered equation,
   * clicking code — because all three answer the same question and only differ in how the answer
   * is computed. Computing it is this file's job: the rendered position is only meaningful next
   * to the source that produced it. Absent means the document is read-only.
   */
  onEdit?: (blockId: string, caret: SourceCaret, point?: { dx: number }) => void;
  onMafsChange?: (blockId: string, expr: string) => void;
  /** Bumping this key re-runs a code block — how the editor makes Cmd+Enter execute. */
  autoRunKey?: (blockId: string) => number;
  /** Editor hint shown on a selected graph, whose own click is taken by the graph. */
  selectedId?: string | null;
  resolveRef?: RefResolver;
  atomKinds?: Record<AtomKind, string>;
  /**
   * Atom id → its own page.
   *
   * Set on the page and in the peek, absent in the editor, for the same reason `resolveRef` is: a
   * document being written may declare an atom that has no page yet. Without it an atom card in a
   * peek would silently lose the link the identical card on the page has — the exact drift the
   * one-table design exists to prevent.
   */
  atomHrefs?: Record<string, string>;
};

/**
 * Map a click on RENDERED output back to an offset in the markdown SOURCE.
 *
 * Rendered text has dropped syntax — `# `, `**`, `$$` — so the offsets do not line up. We take the
 * clicked text node's content, find it in the source, and offset from there. KaTeX output has no
 * counterpart in the source at all, hence the honest fallback to the end.
 */
function caretFromClick(source: string, e: ReactMouseEvent<HTMLElement>): SourceCaret {
  try {
    const d = document as unknown as {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    let node: Node | null = null;
    let off = 0;
    if (d.caretRangeFromPoint) {
      const r = d.caretRangeFromPoint(e.clientX, e.clientY);
      if (r) ((node = r.startContainer), (off = r.startOffset));
    } else if (d.caretPositionFromPoint) {
      const p = d.caretPositionFromPoint(e.clientX, e.clientY);
      if (p) ((node = p.offsetNode), (off = p.offset));
    }
    if (node && node.nodeType === 3) {
      const txt = node.textContent ?? "";
      const idx = source.indexOf(txt);
      if (idx >= 0) return idx + Math.min(off, txt.length);
    }
  } catch {
    /* fall through to end */
  }
  return "end";
}

export function BlockList({ blocks, hooks }: { blocks: Block[]; hooks?: BlockViewHooks }) {
  return (
    <>
      {blocks.map((b) => (
        <BlockView key={b.id} block={b} hooks={hooks} />
      ))}
    </>
  );
}

export default function BlockView({ block, hooks = {} }: { block: Block; hooks?: BlockViewHooks }) {
  const rk = renderKindOf(block);
  const source = "content" in block ? block.content : "";
  const editAt = hooks.onEdit && ((caret: SourceCaret, point?: { dx: number }) => hooks.onEdit!(block.id, caret, point));
  const editFromClick = editAt && ((e: ReactMouseEvent<HTMLElement>) => editAt(caretFromClick(source, e)));

  switch (rk.kind) {
    case "columns":
      return (
        <div className="flex flex-col gap-3 sm:flex-row">
          {rk.columns.map((blocks, i) => (
            <div key={i} className="min-w-0" style={{ flexGrow: rk.widths[i], flexBasis: 0 }}>
              <BlockList blocks={blocks} hooks={hooks} />
            </div>
          ))}
        </div>
      );

    case "atom":
      return (
        <AtomShell
          atomId={rk.atomId}
          kindLabel={hooks.atomKinds?.[rk.atomKind] ?? rk.atomKind}
          label={rk.label}
          href={hooks.atomHrefs?.[rk.atomId]}
        >
          <BlockList blocks={rk.blocks} hooks={hooks} />
        </AtomShell>
      );

    case "heading":
      return (
        <Heading level={rk.level} anchor={rk.anchor} onClick={editFromClick}>
          {rk.text || " "}
        </Heading>
      );

    case "math":
      return (
        <MathRunner
          lines={rk.lines}
          // detectMath already worked out where each rendered line starts in the raw content, from
          // the same walk that produced the lines — so the caret lands on the row that was clicked.
          onRequestEdit={editAt && ((lineIndex, point) => editAt(rk.offsets[lineIndex] ?? "end", point))}
        />
      );

    case "code":
      return (
        <CodeRunner
          code={rk.code}
          lang={rk.runnable ?? "js"}
          displayLang={rk.lang || "texto"}
          runnable={!!rk.runnable}
          readOnly
          // Past the ```info line, whatever its length: measuring the real first line survives
          // fence attributes, which a `3 + lang.length` guess does not.
          onRequestEdit={editAt && ((pos) => editAt(source.indexOf("\n") + 1 + Math.min(pos, rk.code.length)))}
          autoRunKey={hooks.autoRunKey?.(block.id)}
        />
      );

    case "mafs":
      return (
        <div>
          {hooks.selectedId === block.id && (
            <p className="mb-1 font-mono text-[10px] text-ink-muted">Enter para editar como texto</p>
          )}
          <GraphBlock expr={rk.expr} onContentChange={(c) => hooks.onMafsChange?.(block.id, c)} />
        </div>
      );

    case "lean":
      return <LeanBlock code={rk.code} theorem={rk.theorem} />;

    case "artifact":
      if (rk.error) return <ArtifactError name={rk.name} error={rk.error} />;
      if (rk.name === "diagram") return <NodeDiagram {...(rk.props as object | null)} />;
      return <ArtifactError name={rk.name} error="todavía no implementado" />;

    case "embed":
    case "atomref":
      return <RefCard refKind={rk.kind} refPath={rk.ref} label={rk.label} resolve={hooks.resolveRef} />;

    case "markdown":
      return <Prose content={rk.content} onClick={editFromClick} resolveRef={hooks.resolveRef} />;
  }
}

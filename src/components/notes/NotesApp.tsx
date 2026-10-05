import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import "katex/dist/katex.min.css";
import MathSurface from "@/components/artifacts/MathSurface";
import MathBlockEditor from "./math/MathBlockEditor";
import BlockView from "./render/BlockView";
import type { InsertableGroupId } from "@/lib/engine/surface";
import { focusWithoutScroll } from "@/lib/focus";
import {
  listDocs,
  getDoc,
  saveDoc,
  deleteDoc,
  createDoc,
  countLeaves,
  emptyTextBlock,
  makeColumns,
  seedContent,
  fuzzyBlocks,
  updateBlock,
  removeBlock,
  insertAfter,
  moveWithinColumn,
  moveBlockNextTo,
  flattenVisual,
  pathTo,
  edgeLeaf,
  isColumns,
  isAtom,
  isContainer,
  detectFence,
  detectMath,
  writeMathBlock,
  wrapFence,
  MATH_SEED,
  uid,
  MAX_COLS,
  type NoteDoc,
  type Block,
  type LeafBlock,
  type MathBlock,
  type LeafType,
  type BlockType,
  type ColumnsBlock,
  type AtomBlock,
  type AtomKind,
} from "@/lib/notes/model";

/** Lo que necesita el editor de matemáticas para hablar el idioma de la página. */
type MathStrings = {
  hint: string;
  raw: string;
  unsupported: string;
  categories: Record<InsertableGroupId, string>;
};

type Strings = {
  newDoc: string;
  noDocs: string;
  untitled: string;
  back: string;
  hint: string;
  math: MathStrings;
  /** Shared with the published topic pages — see the `topic` group in src/i18n.ts. */
  atomKinds: Record<AtomKind, string>;
};

/* ————— Editor API shared with every (recursive) block via context ————— */
type CaretPos = number | "start" | "end";
type Api = {
  editingId: string | null;
  selectedId: string | null;
  caretFor: (id: string) => CaretPos;
  setContent: (id: string, content: string) => void;
  edit: (id: string, caret?: CaretPos) => void;
  select: (id: string) => void;
  escapeSelect: (id: string) => void;
  enterAfter: (id: string) => void;
  deleteEmpty: (id: string) => void;
  moveBlock: (id: string, dir: -1 | 1) => void;
  moveNextTo: (id: string, targetId: string, place: "before" | "after") => void;
  convert: (id: string, type: BlockType) => void;
  cross: (id: string, dir: "up" | "down" | "left" | "right", col: number) => void;
  compile: (id: string) => void; // exit edit → render (+auto-run for code)
  runKeyFor: (id: string) => number;
  addColumn: (colsId: string) => void;
  removeColumn: (colsId: string, colIndex: number) => void;
  setWidths: (colsId: string, widths: number[]) => void;
  /** Los bloques dibujan interfaz, y la interfaz tiene idioma. */
  strings: MathStrings;
  /** Document vocabulary, not maths vocabulary — kept apart so an atom reads the same on a
   *  published topic page, which has no maths editor at all. */
  atomKinds: Record<AtomKind, string>;
};
const Ctx = createContext<Api | null>(null);
const useApi = () => useContext(Ctx)!;

export default function NotesApp({ strings }: { strings: Strings }) {
  const [docs, setDocs] = useState<NoteDoc[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const refresh = () => setDocs(listDocs());
  useEffect(refresh, []);

  if (activeId) {
    const doc = getDoc(activeId);
    if (!doc) return null;
    return (
      <Editor
        key={doc.id}
        doc={doc}
        strings={strings}
        onBack={() => {
          setActiveId(null);
          refresh();
        }}
      />
    );
  }

  return (
    <DocList
      docs={docs}
      strings={strings}
      onOpen={setActiveId}
      onNew={() => {
        const d = createDoc(strings.untitled);
        refresh();
        setActiveId(d.id);
      }}
      onDelete={(id) => {
        deleteDoc(id);
        refresh();
      }}
    />
  );
}

/* ————————————————————————— Document list ————————————————————————— */
function DocList({
  docs,
  strings,
  onOpen,
  onNew,
  onDelete,
}: {
  docs: NoteDoc[];
  strings: Strings;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <button
        onClick={onNew}
        className="rounded-[var(--radius-sm)] bg-primary px-4 py-2 text-sm font-semibold text-primary-ink"
      >
        + {strings.newDoc}
      </button>
      {docs.length === 0 ? (
        <p className="mt-8 text-ink-muted">{strings.noDocs}</p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => (
            <div key={d.id} className="glass group relative rounded-[var(--radius)] p-4">
              <button onClick={() => onOpen(d.id)} className="block w-full text-left">
                <p className="font-display text-lg font-semibold text-ink">
                  {d.title || strings.untitled}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {countLeaves(d.blocks)} bloques · {new Date(d.updatedAt).toLocaleDateString()}
                </p>
              </button>
              <button
                onClick={() => onDelete(d.id)}
                aria-label="Eliminar"
                className="absolute right-2 top-2 rounded-md px-2 py-1 text-xs text-ink-muted opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ————————————————————————————— Editor ————————————————————————————— */
function Editor({ doc, strings, onBack }: { doc: NoteDoc; strings: Strings; onBack: () => void }) {
  const [title, setTitle] = useState(doc.title);
  const [blocks, setBlocks] = useState<Block[]>(doc.blocks.length ? doc.blocks : [emptyTextBlock()]);
  const [editingId, setEditingId] = useState<string | null>(flattenVisual(blocks)[0] ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runKey, setRunKey] = useState<{ id: string; n: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const caret = useRef<{ id: string; pos: CaretPos } | null>(null);

  // Undo/redo (20 steps), coalescing bursts.
  const undoS = useRef<Block[][]>([]);
  const redoS = useRef<Block[][]>([]);
  const prev = useRef<Block[]>(blocks);
  const applying = useRef(false);
  const canCheckpoint = useRef(true);

  useEffect(() => {
    if (applying.current) {
      applying.current = false;
      prev.current = blocks;
      return;
    }
    if (canCheckpoint.current) {
      undoS.current.push(prev.current);
      if (undoS.current.length > 20) undoS.current.shift();
      redoS.current = [];
      canCheckpoint.current = false;
    }
    prev.current = blocks;
  }, [blocks]);
  useEffect(() => {
    const h = setTimeout(() => (canCheckpoint.current = true), 500);
    return () => clearTimeout(h);
  }, [blocks]);

  const undo = () => {
    if (!undoS.current.length) return;
    redoS.current.push(blocks);
    applying.current = true;
    setBlocks(undoS.current.pop()!);
    setEditingId(null);
    setSelectedId(null);
  };
  const redo = () => {
    if (!redoS.current.length) return;
    undoS.current.push(blocks);
    applying.current = true;
    setBlocks(redoS.current.pop()!);
    setEditingId(null);
    setSelectedId(null);
  };
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        // Dentro de un campo de matemáticas, deshacer es del campo. Este oyente
        // está en `window`, así que sin esto corregir un exponente y pulsar Cmd+Z
        // revertiría el documento entero. El objetivo real vive en un shadow DOM,
        // de ahí composedPath() y no e.target.
        if (e.composedPath().some((node) => node instanceof Element && node.tagName === "MATH-FIELD")) {
          return;
        }
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  useEffect(() => {
    if (!selectedId || editingId) return;
    const container = containerRef.current;
    if (container) focusWithoutScroll(container);
  }, [selectedId, editingId]);

  useEffect(() => {
    const h = setTimeout(() => saveDoc({ ...doc, title, blocks }), 400);
    return () => clearTimeout(h);
  }, [title, blocks, doc]);

  /* — caret placement helpers — */
  const focusAt = (id: string, pos: CaretPos) => {
    caret.current = { id, pos };
    setEditingId(id);
    setSelectedId(null);
  };
  const firstLinePos = (content: string, col: number) => {
    const nl = content.indexOf("\n");
    return Math.min(col, nl === -1 ? content.length : nl);
  };
  const lastLinePos = (content: string, col: number) => {
    const start = content.lastIndexOf("\n") + 1;
    return start + Math.min(col, content.length - start);
  };
  const enterBlock = (b: Block, from: "top" | "bottom", col: number) => {
    if (isContainer(b)) focusAt(edgeLeaf(b, from), from === "top" ? "start" : "end");
    else focusAt(b.id, from === "top" ? firstLinePos(b.content, col) : lastLinePos(b.content, col));
  };

  /* — tree ops (all via helpers; undo effect handles history) — */
  const setContent = (id: string, content: string) =>
    setBlocks((bs) => updateBlock(bs, id, (b) => (isContainer(b) ? b : { ...b, content })));
  const addTextAfter = (id: string) => {
    const nb = emptyTextBlock();
    setBlocks((bs) => insertAfter(bs, id, nb));
    focusAt(nb.id, "end");
  };
  const deleteEmpty = (id: string) => {
    const flat = flattenVisual(blocks);
    if (flat.length <= 1) return;
    const idx = flat.indexOf(id);
    const focus = flat[idx - 1] ?? flat[idx + 1];
    setBlocks((bs) => removeBlock(bs, id));
    if (focus) focusAt(focus, "end");
  };
  const removeSelected = (id: string) => {
    const flat = flattenVisual(blocks);
    const idx = flat.indexOf(id);
    setBlocks((bs) => removeBlock(bs, id));
    const neighbor = flat[idx - 1] ?? flat[idx + 1] ?? null;
    setSelectedId(neighbor);
    setEditingId(null);
  };
  const moveBlock = (id: string, dir: -1 | 1) => setBlocks((bs) => moveWithinColumn(bs, id, dir));
  const moveNextTo = (id: string, targetId: string, place: "before" | "after") =>
    setBlocks((bs) => moveBlockNextTo(bs, id, targetId, place));
  const convert = (id: string, type: BlockType) => {
    if (type === "columns") {
      const cols = makeColumns(2);
      setBlocks((bs) => updateBlock(bs, id, () => cols));
      focusAt(cols.columns[0].blocks[0].id, "end");
      return;
    }
    // code & latex become plain-markdown text blocks (a code fence / $$…$$) → export-native.
    if (type === "code") {
      setBlocks((bs) => updateBlock(bs, id, (b) => ({ id: b.id, type: "text", content: wrapFence("js", "") })));
      focusAt(id, 6); // caret on the empty code line, inside ```js … ```
      return;
    }
    if (type === "latex") {
      setBlocks((bs) => updateBlock(bs, id, (b) => ({ id: b.id, type: "text", content: MATH_SEED })));
      focusAt(id, 3); // caret between the $$ … $$
      return;
    }
    setBlocks((bs) =>
      updateBlock(bs, id, (b) => ({ id: b.id, type: type as LeafType, content: seedContent(type as LeafType) })),
    );
    focusAt(id, "end");
  };
  const addColumn = (colsId: string) =>
    setBlocks((bs) =>
      updateBlock(bs, colsId, (b) =>
        !isColumns(b) || b.columns.length >= MAX_COLS
          ? b
          : {
              ...b,
              columns: [...b.columns, { id: uid(), blocks: [emptyTextBlock()] }],
              widths: [...b.widths, 1],
            },
      ),
    );
  const removeColumn = (colsId: string, ci: number) =>
    setBlocks((bs) =>
      updateBlock(bs, colsId, (b) =>
        !isColumns(b) || b.columns.length <= 1
          ? b
          : { ...b, columns: b.columns.filter((_, k) => k !== ci), widths: b.widths.filter((_, k) => k !== ci) },
      ),
    );
  const setWidths = (colsId: string, widths: number[]) =>
    setBlocks((bs) => updateBlock(bs, colsId, (b) => (isColumns(b) ? { ...b, widths } : b)));

  /* — navigation — */
  const cross = (id: string, dir: "up" | "down" | "left" | "right", col: number) => {
    if (dir === "left" || dir === "right") {
      const flat = flattenVisual(blocks);
      const i = flat.indexOf(id);
      const t = dir === "right" ? flat[i + 1] : flat[i - 1];
      if (t) focusAt(t, dir === "right" ? "start" : "end");
      else if (dir === "right") addTextAfter(id);
      return;
    }
    const path = pathTo(blocks, id);
    if (!path) return;
    for (let p = path.length - 1; p >= 0; p--) {
      const f = path[p];
      const nb = dir === "down" ? f.arr[f.index + 1] : f.arr[f.index - 1];
      if (nb) {
        enterBlock(nb, dir === "down" ? "top" : "bottom", col);
        return;
      }
    }
  };
  const selectMove = (dir: -1 | 1) => {
    if (!selectedId) return;
    const flat = flattenVisual(blocks);
    const j = flat.indexOf(selectedId) + dir;
    if (j >= 0 && j < flat.length) setSelectedId(flat[j]);
  };

  const onContainerKey = (e: KeyboardEvent) => {
    if (editingId || !selectedId) return;
    if (e.key === "Escape") {
      // second ESC (after edit→select) deselects the block
      e.preventDefault();
      setSelectedId(null);
      containerRef.current?.blur();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removeSelected(selectedId);
    } else if (e.key === "Enter") {
      e.preventDefault();
      caret.current = { id: selectedId, pos: "end" };
      setEditingId(selectedId);
      setSelectedId(null);
    } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      moveBlock(selectedId, e.key === "ArrowUp" ? -1 : 1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      selectMove(-1);
    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      selectMove(1);
    }
  };

  const api: Api = {
    editingId,
    selectedId,
    caretFor: (id) => (editingId === id && caret.current?.id === id ? caret.current.pos : "end"),
    setContent,
    edit: (id, pos = "end") => focusAt(id, pos),
    select: (id) => {
      setSelectedId(id);
      setEditingId(null);
    },
    escapeSelect: (id) => {
      setEditingId(null);
      setSelectedId(id);
    },
    enterAfter: addTextAfter,
    deleteEmpty,
    moveBlock,
    moveNextTo,
    convert,
    cross,
    compile: (id) => {
      setEditingId(null);
      setSelectedId(id);
      setRunKey((k) => ({ id, n: (k?.n ?? 0) + 1 }));
    },
    runKeyFor: (id) => (runKey?.id === id ? runKey.n : 0),
    addColumn,
    removeColumn,
    setWidths,
    strings: strings.math,
    atomKinds: strings.atomKinds,
  };

  return (
    <div ref={containerRef} onKeyDown={onContainerKey} tabIndex={-1} className="outline-none">
      <div className="mb-4">
        <button onClick={onBack} className="text-sm text-ink-muted hover:text-primary">
          ← {strings.back}
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={strings.untitled}
        className="mb-2 w-full bg-transparent font-display text-4xl font-semibold text-ink outline-none placeholder:text-ink-muted/50"
      />
      <p className="mb-6 font-mono text-xs text-ink-muted">{strings.hint}</p>

      <Ctx.Provider value={api}>
        <BlockList blocks={blocks} />
      </Ctx.Provider>
    </div>
  );
}

/* ————————————————————————— Recursive rendering ————————————————————————— */
function BlockList({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-1">
      {blocks.map((b) => (
        <BlockRow key={b.id} block={b} />
      ))}
    </div>
  );
}

function BlockRow({ block }: { block: Block }) {
  if (isColumns(block)) return <ColumnsRow block={block} />;
  if (isAtom(block)) return <AtomRow block={block} />;
  return <LeafRow block={block} />;
}

/* — atom block: one formal, individually referenceable unit (the Dato level) —
   The chrome is deliberately plain here. An atom is authored by writing it in the .md; the
   editor's job is to show its boundary and its id so you can see what you are pointing at. */
function AtomRow({ block }: { block: AtomBlock }) {
  const api = useApi();
  return (
    <div
      data-block-id={block.id}
      className="my-3 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3"
    >
      <p className="mb-2 flex items-baseline gap-2 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-muted">
        <span className="text-accent">{api.atomKinds[block.kind]}</span>
        <span>{block.atomId}</span>
      </p>
      <BlockList blocks={block.blocks} />
    </div>
  );
}

/* — columns block — */
function ColumnsRow({ block }: { block: ColumnsBlock }) {
  const api = useApi();
  const rowRef = useRef<HTMLDivElement | null>(null);
  const atMax = block.columns.length >= MAX_COLS;

  const startDrag = (i: number, e: ReactPointerEvent) => {
    e.preventDefault();
    const rowW = rowRef.current?.getBoundingClientRect().width ?? 1;
    const startX = e.clientX;
    const wi = block.widths[i];
    const wj = block.widths[i + 1];
    const total = block.widths.reduce((a, b) => a + b, 0);
    const onMove = (ev: PointerEvent) => {
      const dW = ((ev.clientX - startX) / rowW) * total;
      const w = [...block.widths];
      w[i] = Math.max(0.3, wi + dW);
      w[i + 1] = Math.max(0.3, wj - dW);
      api.setWidths(block.id, w);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className="my-2" data-block-id={block.id}>
      <div ref={rowRef} className="flex items-stretch">
        {block.columns.map((col, i) => (
          <div key={col.id} className="contents">
            <div style={{ flexGrow: block.widths[i], flexBasis: 0 }} className="group/col relative min-w-0 px-2">
              <BlockList blocks={col.blocks} />
              {block.columns.length > 1 && (
                <button
                  onClick={() => api.removeColumn(block.id, i)}
                  aria-label="Quitar columna"
                  className="absolute -right-1 -top-4 rounded px-1 text-xs text-ink-muted opacity-0 transition-opacity hover:text-red-500 group-hover/col:opacity-100"
                >
                  ✕
                </button>
              )}
            </div>
            {i < block.columns.length - 1 && (
              <div
                onPointerDown={(e) => startDrag(i, e)}
                className="group/sep relative w-2 shrink-0 cursor-col-resize self-stretch"
              >
                <div className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover/sep:bg-primary" />
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() => api.addColumn(block.id)}
        disabled={atMax}
        title={atMax ? "Máximo 6 columnas en el plan gratuito" : "Añadir columna"}
        className="mt-1 font-mono text-xs text-ink-muted transition-colors enabled:hover:text-primary disabled:opacity-70"
      >
        {atMax ? "Máx. columnas" : "+ columna"}
      </button>
    </div>
  );
}

/**
 * Which line of a `$$…$$` block the caret is on, given its offset in the raw content.
 *
 * The rest of the editor speaks in raw offsets — that is what a textarea understands — and the
 * maths editor speaks in lines. This is the one place that translates, so clicking a rendered line
 * and pressing Cmd+Enter both land on the same row.
 */
function mathCaretLine(math: MathBlock, caret: CaretPos): number {
  if (caret === "start") return 0;
  if (caret === "end") return math.lines.length - 1;

  let line = 0;
  math.offsets.forEach((offset, index) => {
    if (offset <= caret) line = index;
  });
  return line;
}

/* — leaf block — */
function LeafRow({ block }: { block: LeafBlock }) {
  const api = useApi();
  const editing = api.editingId === block.id;
  const selected = api.selectedId === block.id;
  const focusCaret = api.caretFor(block.id);

  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [menuIdx, setMenuIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  // El escape hatch del bloque de ecuación: ver el LaTeX crudo. Se apaga al salir
  // de la edición, así que reabrir un bloque siempre vuelve al editor visual.
  const [rawMath, setRawMath] = useState(false);
  useEffect(() => {
    if (!editing) setRawMath(false);
  }, [editing]);

  // Dónde se hizo clic para entrar a editar la ecuación. En una ref porque no
  // cambia lo que se pinta: sólo dónde arranca el cursor, y sólo al montarse.
  const mathClickRef = useRef<{ dx: number } | null>(null);

  const slashActive =
    editing && block.type === "text" && /^\/\S*$/.test(block.content) && !dismissed;
  const slashQuery = slashActive ? block.content.slice(1) : "";
  const menu = slashActive
    ? (() => {
        const m = fuzzyBlocks(slashQuery);
        return m.length ? m : fuzzyBlocks("");
      })()
    : [];

  useLayoutEffect(() => {
    if (editing && taRef.current) {
      const el = taRef.current;
      // Sin arrastrar la página: el bloque que se abre es más alto que el
      // renderizado, y centrarlo mueve la vista de quien acaba de hacer clic.
      focusWithoutScroll(el);
      const pos =
        focusCaret === "end" ? el.value.length : focusCaret === "start" ? 0 : Math.min(focusCaret, el.value.length);
      el.selectionStart = el.selectionEnd = pos;
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [editing, focusCaret]);

  useEffect(() => {
    setMenuIdx(0);
    if (!block.content.startsWith("/")) setDismissed(false);
  }, [block.content]);

  const rawKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      // compile: exit raw edit → render the block (code auto-runs)
      e.preventDefault();
      api.compile(block.id);
      return;
    }
    if (slashActive) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMenuIdx((i) => Math.min(i + 1, menu.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMenuIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        const pick = menu[Math.min(menuIdx, menu.length - 1)];
        if (pick) api.convert(block.id, pick.type);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissed(true);
        return;
      }
    }

    if (!e.altKey && !e.metaKey && !e.ctrlKey && e.key.startsWith("Arrow")) {
      const el = e.currentTarget;
      const c = el.selectionStart;
      const before = el.value.slice(0, c);
      const after = el.value.slice(c);
      const col = c - (before.lastIndexOf("\n") + 1);
      const collapsed = el.selectionStart === el.selectionEnd;
      if (e.key === "ArrowDown" && !after.includes("\n")) return void (e.preventDefault(), api.cross(block.id, "down", col));
      if (e.key === "ArrowUp" && !before.includes("\n")) return void (e.preventDefault(), api.cross(block.id, "up", col));
      if (e.key === "ArrowRight" && collapsed && c === el.value.length)
        return void (e.preventDefault(), api.cross(block.id, "right", col));
      if (e.key === "ArrowLeft" && collapsed && c === 0)
        return void (e.preventDefault(), api.cross(block.id, "left", col));
    }

    // ```lang + Enter → autocomplete a full fenced code block (markdown-native code)
    if (e.key === "Enter" && /^```[a-zA-Z0-9+#._-]*$/.test(block.content)) {
      e.preventDefault();
      api.setContent(block.id, block.content + "\n\n```");
      return;
    }
    if (e.key === "Backspace" && block.content === "") {
      e.preventDefault();
      api.deleteEmpty(block.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      api.escapeSelect(block.id);
    } else if (e.key === "Enter" && !e.shiftKey && (block.type === "text" || block.type === "heading")) {
      // Enter → new block below (even inside a ``` fence or $$…$$); Shift+Enter → newline within.
      e.preventDefault();
      api.enterAfter(block.id);
    } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      api.moveBlock(block.id, e.key === "ArrowUp" ? -1 : 1);
    }
  };

  const rawEditor = (mono = false) => (
    <textarea
      ref={taRef}
      value={block.content}
      onChange={(e) => {
        api.setContent(block.id, e.target.value);
        e.target.style.height = "auto";
        e.target.style.height = e.target.scrollHeight + "px";
      }}
      onKeyDown={rawKeyDown}
      // Perder el foco cierra la edición, PERO no cuando el foco se va a un botón
      // del propio bloque —la paleta de matemáticas, el conmutador a LaTeX—: si no,
      // el primer clic en la paleta cerraría el editor en vez de insertar.
      onBlur={(e) => {
        const to = e.relatedTarget;
        if (to instanceof Node && e.currentTarget.closest("[data-block-id]")?.contains(to)) return;
        api.escapeSelect(block.id);
      }}
      rows={1}
      spellCheck={false}
      className={`w-full resize-none bg-transparent leading-relaxed text-ink outline-none ${mono ? "font-mono text-sm" : ""}`}
      style={mono ? { fontFamily: "var(--f-mono)" } : undefined}
    />
  );

  // Drag the "⠿" handle to reorder — a plain click (no movement) still just selects, same as
  // before. Drop-target is whichever row is under the pointer, split at its vertical midpoint;
  // decided via local closure state (not React state) so pointerup always reads the live value,
  // never a stale one from the render that started the drag.
  const dragOverElRef = useRef<HTMLElement | null>(null);
  const onHandlePointerDown = (e: ReactPointerEvent) => {
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let target: { id: string; place: "before" | "after" } | null = null;

    const clearHighlight = () => {
      if (dragOverElRef.current) dragOverElRef.current.style.boxShadow = "";
      dragOverElRef.current = null;
    };
    const onMove = (ev: PointerEvent) => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
        dragging = true;
        document.body.style.cursor = "grabbing";
      }
      const el = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>(
        "[data-block-id]",
      );
      if (!el || el.dataset.blockId === block.id) {
        clearHighlight();
        target = null;
        return;
      }
      const r = el.getBoundingClientRect();
      const place: "before" | "after" = ev.clientY < r.top + r.height / 2 ? "before" : "after";
      target = { id: el.dataset.blockId!, place };
      if (dragOverElRef.current !== el) clearHighlight();
      dragOverElRef.current = el;
      el.style.boxShadow = `inset 0 ${place === "before" ? "2px" : "-2px"} 0 0 var(--c-primary)`;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      clearHighlight();
      if (dragging && target) api.moveNextTo(block.id, target.id, target.place);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // READ mode is not decided here. `renderKindOf` decides, and BlockView wires the answer — the
  // same pair the published page and the peek panel use, so a block can never look like one thing
  // in the editor and another on the site. Only EDIT mode is this component's own business.
  const read = (
    <BlockView
      block={block}
      hooks={{
        onEdit: (id, caret, point) => {
          mathClickRef.current = point ?? null;
          api.edit(id, caret);
        },
        onMafsChange: (id, c) => api.setContent(id, c),
        autoRunKey: (id) => api.runKeyFor(id),
        selectedId: api.selectedId,
        atomKinds: api.atomKinds,
      }}
    />
  );

  let body: ReactNode;
  if (block.type === "diagram") {
    body = read;
  } else if (block.type === "mafs") {
    body = editing ? rawEditor(true) : read;
  } else if (block.type === "heading") {
    body = editing ? rawEditor(false) : read;
  } else {
    // text (and any legacy code/latex): markdown-native. Whether it is a fence, an equation, an
    // embed or prose is BlockView's call; the editor only needs to know if it is maths, because
    // maths is the one thing edited with something other than a textarea.
    const fence = detectFence(block.content);
    const math = fence ? null : detectMath(block.content);
    if (editing && math && !rawMath) {
      // Maths is written with MathLive, not as raw LaTeX: the engine can already read
      // `\operatorname{expandir}(…)`, the student can't be expected to type it. What is stored is
      // still the markdown of the block — the editor writes it back through writeMathBlock.
      body = (
        <MathSurface>
          <MathBlockEditor
            initialLines={math.lines}
            focusLine={mathCaretLine(math, focusCaret)}
            focusPoint={mathClickRef.current}
            labels={api.strings.categories}
            unsupportedHint={api.strings.unsupported}
            onChange={(lines) => api.setContent(block.id, writeMathBlock(lines))}
            onCompile={() => api.compile(block.id)}
            onEscape={() => api.escapeSelect(block.id)}
            onCross={(direction) => api.cross(block.id, direction, 0)}
            onMoveBlock={(delta) => api.moveBlock(block.id, delta)}
          />
          <div className="flex items-center justify-between gap-3 px-2 pb-1">
            <p className="font-mono text-[11px] text-ink-muted">{api.strings.hint}</p>
            <button
              type="button"
              onClick={() => setRawMath(true)}
              className="font-mono text-[11px] text-ink-muted transition-colors hover:text-primary"
            >
              {api.strings.raw}
            </button>
          </div>
        </MathSurface>
      );
    } else if (editing) {
      // Edit as easy raw markdown text (mono when it's a code fence). Cmd+Enter renders/compiles.
      body = rawEditor(!!fence);
    } else {
      body = read;
    }
  }

  return (
    <div
      data-block-id={block.id}
      className={`group relative rounded-[var(--radius-sm)] px-1 py-0.5 transition-colors ${
        selected ? "ring-2 ring-primary" : ""
      }`}
    >
      <button
        onClick={() => api.select(block.id)}
        onPointerDown={onHandlePointerDown}
        aria-label="Seleccionar o arrastrar bloque"
        title="Clic: seleccionar · Arrastrar: mover"
        className="absolute -left-4 inset-y-0 flex w-5 cursor-grab select-none items-center justify-center font-mono text-ink-muted/40 opacity-0 transition-opacity hover:text-ink-muted active:cursor-grabbing group-hover:opacity-100"
      >
        ⠿
      </button>
      {body}

      {slashActive && (
        <div className="glass absolute left-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-[var(--radius-sm)] p-1">
          {menu.map((d, idx) => (
            <button
              key={d.type}
              onMouseEnter={() => setMenuIdx(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                api.convert(block.id, d.type);
              }}
              className={`flex w-full items-center justify-between rounded-[var(--radius-sm)] px-3 py-1.5 text-left text-sm ${
                idx === menuIdx ? "bg-primary/15 text-primary" : "text-ink"
              }`}
            >
              <span>{d.label}</span>
              <span className="font-mono text-xs text-ink-muted">/{d.keys[0]}</span>
            </button>
          ))}
          <p className="px-3 py-1 font-mono text-[10px] text-ink-muted">Tab · Enter para elegir</p>
        </div>
      )}
    </div>
  );
}

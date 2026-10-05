/*
  PeekPanel — one panel of the peek stack. Markup and nothing else.

  Split from PeekHost on purpose, and loaded with React.lazy. This file imports BlockList, which
  statically imports CodeRunner, MathRunner, GraphBlock and NodeDiagram — @xyflow/react among them.
  Bundled into the host, every topic page would download all four at idle whether or not anybody
  ever opens a peek. The host is the listener and the reducer; the renderer arrives with the first
  panel, in parallel with the first fetch. Do not merge the two files back together.

  Presentation is CSS-only across form factors: a right rail on desktop, a bottom sheet under
  640px, and "stacking becomes replacing" is `max-sm:hidden` on the panels that are not on top.
  One state machine, two looks — no matchMedia, no second implementation.
*/

import { useEffect, useRef } from "react";

import { BlockList } from "@/components/notes/render/BlockView";
import { focusWithoutScroll } from "@/lib/focus";
import { resolveRefIn } from "@/lib/notes/refs";
import type { AtomKind } from "@/lib/notes/model";
import type { PeekEntry } from "@/lib/peek";

export type PeekStrings = {
  title: string;
  close: string;
  back: string;
  expand: string;
  loading: string;
  error: string;
};

/** Depth `d` shows this much of the panel beneath it. Capped so a deep stack stays readable. */
const STEP_PX = 24;
const MAX_INSET_PX = 96;

/** How far down the sheet has to be dragged before letting go dismisses it. */
const DISMISS_FRACTION = 0.25;

export default function PeekPanel({
  entry,
  depth,
  isTop,
  atomKinds,
  strings,
  onDismiss,
}: {
  entry: PeekEntry;
  depth: number;
  isTop: boolean;
  atomKinds: Record<AtomKind, string>;
  strings: PeekStrings;
  /** Escape, ×, ‹ and the sheet swipe all mean this. The host turns it into history navigation. */
  onDismiss: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Focus lands on the panel, not on its first link: the reader asked to READ this, and a fixed
  // element focused without preventScroll drags the page behind it (see src/lib/focus.ts).
  useEffect(() => {
    if (isTop && panelRef.current) focusWithoutScroll(panelRef.current);
  }, [isTop]);

  // Scroll to the anchor once there is something to scroll to. Not `behavior: "smooth"`: the
  // reduced-motion kill switch in global.css covers CSS, not scroll options.
  useEffect(() => {
    if (entry.status !== "ready" || !entry.anchor) return;
    bodyRef.current?.querySelector(`#${CSS.escape(entry.anchor)}`)?.scrollIntoView({ block: "start" });
  }, [entry.status, entry.anchor]);

  /*
    Drag-to-dismiss, on the handle ONLY.

    Not on the whole sheet: the body can hold a Mafs scene or a MathLive field, both of which own
    their pointer events, and a full-surface gesture would also need a "only when scrollTop is 0"
    rule that goes wrong the moment a nested scroller exists. The handle is unambiguous.

    The transform is written straight to the node rather than held in state — a drag is 60 frames a
    second of a value nothing else reads, and re-rendering the document tree for each one would
    make the gesture the most expensive thing on the page.
  */
  const dragFrom = useRef<number | null>(null);

  const onHandleDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragFrom.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onHandleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragFrom.current === null || !panelRef.current) return;
    const dy = Math.max(0, event.clientY - dragFrom.current);
    panelRef.current.style.transform = `translateY(${dy}px)`;
  };

  const onHandleUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (dragFrom.current === null || !panel) return;

    const dy = event.clientY - dragFrom.current;
    dragFrom.current = null;
    panel.style.transform = "";
    if (dy > panel.offsetHeight * DISMISS_FRACTION) onDismiss();
  };

  const inset = Math.min(depth * STEP_PX, MAX_INSET_PX);
  const doc = entry.doc;

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal={isTop || undefined}
      aria-label={`${strings.title}: ${doc?.title || entry.label || entry.ref}`}
      // The host's focus guard and Tab trap look for this; only ever one in the tree.
      data-peek-top={isTop ? "" : undefined}
      // Lower panels are inert rather than merely covered: keyboard, pointer and screen readers all
      // stop at the top one, in one attribute, with no bookkeeping over foreign DOM. It also means
      // the sliver they show is decoration and not a target — stepping back is `‹`, and the
      // backdrop closes the stack. Making the sliver clickable would mean giving up `inert`.
      inert={!isTop}
      style={{ "--peek-inset": `${inset}px` } as React.CSSProperties}
      className={[
        "glass fixed flex flex-col overflow-hidden",
        // Desktop: a right rail. Deeper panels start further right, so the one beneath keeps a
        // sliver showing — and opening a new one never relayouts the panels already painted.
        "sm:inset-y-0 sm:right-0 sm:left-[calc(100vw-var(--peek-w)+var(--peek-inset))]",
        // Mobile: a bottom sheet. Only the top one is drawn; the stack is still four deep in state.
        "max-sm:inset-x-0 max-sm:bottom-0 max-sm:h-[92dvh] max-sm:rounded-t-[var(--radius)]",
        isTop ? "" : "max-sm:hidden",
      ].join(" ")}
    >
      {/* Sheet handle: the drag target on mobile, absent on desktop. `touch-none` so the browser
          does not claim the gesture as a scroll before the first pointermove arrives. */}
      <div
        aria-hidden
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onPointerCancel={onHandleUp}
        className="shrink-0 cursor-grab touch-none py-2 sm:hidden"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-ink/15" />
      </div>

      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        {/* One control, two meanings: ‹ steps back into the stack, × leaves it. Both are the same
            dismissal, so neither form factor needs to know which one it is showing. */}
        <button
          type="button"
          onClick={onDismiss}
          aria-label={depth > 0 ? strings.back : strings.close}
          className="rounded-[var(--radius-sm)] px-2 py-1 font-mono text-sm text-ink-muted transition-colors hover:text-ink"
        >
          {depth > 0 ? "‹" : "×"}
        </button>

        <p className="min-w-0 flex-1 truncate text-sm text-ink">{doc?.title || entry.label || entry.ref}</p>

        {/* A real link, not a button: cmd-click opens the page in a tab, exactly like the trigger
            that opened this panel. Live while loading and while errored, because the href is known
            from the ref alone. */}
        <a
          href={entry.href}
          aria-label={strings.expand}
          title={strings.expand}
          className="rounded-[var(--radius-sm)] px-2 py-1 font-mono text-sm text-ink-muted no-underline transition-colors hover:text-ink"
        >
          ⤢
        </a>
      </header>

      <div
        ref={bodyRef}
        // `overscroll-contain` so reaching the end of a panel does not chain into the locked page.
        className="reading min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        {entry.status === "loading" && <p className="text-sm text-ink-muted">{strings.loading}</p>}

        {entry.status === "error" && (
          <p className="text-sm text-ink-muted">
            {strings.error}{" "}
            <a href={entry.href} className="text-primary underline decoration-dotted">
              {strings.expand}
            </a>
          </p>
        )}

        {doc && (
          <>
            <h2 className="font-display text-2xl font-semibold text-ink">{doc.title}</h2>
            {doc.summary && <p className="mt-2 text-ink-muted">{doc.summary}</p>}
            <div className="mt-4">
              <BlockList
                blocks={doc.blocks}
                // Read-only by construction: no onEdit, no onMafsChange, no autoRunKey. The same
                // two hooks the published page passes, so a block looks identical in both.
                hooks={{
                  resolveRef: (ref) => resolveRefIn(doc.links, ref),
                  atomKinds,
                  atomHrefs: doc.atomHrefs,
                }}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

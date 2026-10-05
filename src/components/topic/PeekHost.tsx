/*
  PeekHost — the one island on a topic page, and the only thing that owns peek state.

  It is deliberately small. Every decision worth getting wrong lives in src/lib/peek.ts as a pure
  function (shouldPeek, decidePeek, peekReducer, peekEntry) and is tested in node; this file is the
  DOM around them: one delegated listener, one portal, one history contract.

  Three rules that are not negotiable, each of which was a bug waiting to happen:

  1. THE PORTAL. Panels are `.glass`, and `.glass` sets `isolation: isolate` (global.css), so a
     panel rendered inside the page's stacking context could never rise above the nav. This is the
     same trap that pushed MathCommandPopover into a portal. Do not "simplify" it.

  2. EVERY CLOSE GOES THROUGH HISTORY. Each open pushes a history entry; Escape, ×, ‹ and the
     backdrop all navigate rather than calling setStack. Closing directly would leave the pushed
     entries orphaned, so after three escapes the reader would need three Backs to leave the page.

  3. ESCAPE IN THE CAPTURE PHASE, and only while the stack is not empty — the same shape
     MathPalette uses, so nothing underneath (the editor's Escape-to-select, above all) also acts
     on a keystroke that was meant for the top panel.
*/

import { lazy, Suspense, useCallback, useEffect, useReducer, useRef } from "react";
import { createPortal } from "react-dom";

import { focusWithoutScroll } from "@/lib/focus";
import type { AtomKind } from "@/lib/notes/model";
import {
  decidePeek,
  onPeekOpen,
  peekEntry,
  peekReducer,
  shouldPeek,
  type PeekDoc,
  type PeekEntry,
  type PeekRequest,
} from "@/lib/peek";
import type { Locale } from "@/i18n";
import type { PeekStrings } from "./PeekPanel";

const PeekPanel = lazy(() => import("./PeekPanel"));

/** The key our history entries carry. Namespaced so a real navigation's state, or Astro's, can
 *  never be mistaken for a peek stack. Holds the whole ref chain, not a depth: popstate fires
 *  going FORWARD too, and an entry you did not store cannot be rebuilt. */
const HISTORY_KEY = "msPeek";

type PeekHistoryState = { [HISTORY_KEY]?: string[] };

const chainOf = (state: unknown): string[] => {
  const chain = (state as PeekHistoryState | null)?.[HISTORY_KEY];
  return Array.isArray(chain) ? chain : [];
};

export default function PeekHost({
  locale,
  atomKinds,
  strings,
}: {
  locale: Locale;
  atomKinds: Record<AtomKind, string>;
  strings: PeekStrings;
}) {
  const [stack, dispatch] = useReducer(peekReducer, [] as PeekEntry[]);

  // The click listener binds once and must still see the current stack, so it reads through a ref
  // rather than closing over a snapshot that goes stale on the first push.
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const rootRef = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<string, PeekDoc>());
  const inFlight = useRef(new Set<string>());
  /** Where focus came from, by ref, so closing a panel returns it even after a rebuild. */
  const triggers = useRef(new Map<string, HTMLElement>());

  const open = useCallback(
    (request: PeekRequest) => {
      const entry = peekEntry(request, locale);
      if (!entry) return;
      if (entry.trigger) triggers.current.set(entry.ref, entry.trigger);

      const cached = cache.current.get(entry.url);
      dispatch({
        type: "push",
        entry: cached ? { ...entry, status: "ready", doc: cached } : entry,
      });

      const next = [...stackRef.current.map((e) => e.ref), entry.ref];
      history.pushState({ [HISTORY_KEY]: next } satisfies PeekHistoryState, "", location.href);
    },
    [locale],
  );

  /* —————————————————————— what opens a peek —————————————————————— */

  // One delegated listener for the whole document. The triggers are static Astro HTML with no JS
  // of their own (pieces.tsx emits `<a href data-peek-ref>`), and a panel is portalled to
  // document.body, so a trigger INSIDE a peek bubbles to this same listener with nothing extra
  // wired — nesting composes for free.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLElement>("[data-peek-ref]") ?? null;

      const raw = shouldPeek({
        button: event.button,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        defaultPrevented: event.defaultPrevented,
        peekRef: anchor?.dataset.peekRef ?? null,
        linkTarget: anchor?.getAttribute("target") ?? null,
      });
      if (!raw) return;

      // Ask BEFORE preventing: a decision of "navigate" must leave the anchor alone so the browser
      // does what it was always going to do. At depth 4 and on a cycle, that is the whole feature.
      const entry = peekEntry({ ref: raw }, locale);
      if (decidePeek(stackRef.current, entry?.targetId ?? null).kind !== "push") return;

      event.preventDefault();
      open({ ref: raw, label: anchor?.textContent ?? "", trigger: anchor });
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [locale, open]);

  // The programmatic door, for islands that have no anchor to click — KnowledgeGraph's onNodeClick.
  useEffect(
    () =>
      onPeekOpen((request) => {
        const entry = peekEntry(request, locale);
        if (decidePeek(stackRef.current, entry?.targetId ?? null).kind !== "push") return;
        open(request);
      }),
    [locale, open],
  );

  /* —————————————————————— fetching —————————————————————— */

  useEffect(() => {
    for (const entry of stack) {
      if (entry.status !== "loading" || inFlight.current.has(entry.ref)) continue;
      inFlight.current.add(entry.ref);

      fetch(entry.url)
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status));
          return res.json() as Promise<PeekDoc>;
        })
        .then((doc) => {
          cache.current.set(entry.url, doc);
          // peekReducer drops this if the entry is gone or already settled, which is the entire
          // stale-response guard — no AbortController, no cleanup race.
          dispatch({ type: "loaded", ref: entry.ref, doc });
        })
        .catch(() => dispatch({ type: "failed", ref: entry.ref }))
        .finally(() => inFlight.current.delete(entry.ref));
    }
  }, [stack]);

  /* —————————————————————— history —————————————————————— */

  useEffect(() => {
    /** Bring the stack in line with a history entry, in either direction. */
    const applyChain = (chain: string[]) => {
      const current = stackRef.current;

      if (chain.length <= current.length) {
        dispatch({ type: "truncate", length: chain.length });
        return;
      }

      // Forward, or a reload that landed on a peek entry. The refs are all we stored, so labels
      // come back empty and fill in from the fetched title; the trigger is gone for good.
      for (const ref of chain.slice(current.length)) {
        const entry = peekEntry({ ref, trigger: triggers.current.get(ref) ?? null }, locale);
        if (!entry) continue;
        const cached = cache.current.get(entry.url);
        dispatch({ type: "push", entry: cached ? { ...entry, status: "ready", doc: cached } : entry });
      }
    };

    const onPop = (event: PopStateEvent) => applyChain(chainOf(event.state));
    window.addEventListener("popstate", onPop);

    // A reload with peeks open leaves history entries behind that nothing is showing; without this
    // the back button would appear dead for as many presses as there were panels.
    applyChain(chainOf(history.state));

    return () => window.removeEventListener("popstate", onPop);
  }, [locale]);

  /** One level down. Never setStack: see rule 2 at the top of this file. */
  const dismiss = useCallback(() => history.back(), []);
  const closeAll = useCallback(() => {
    if (stackRef.current.length) history.go(-stackRef.current.length);
  }, []);

  /* —————————————————————— keyboard, focus, scroll —————————————————————— */

  const isOpen = stack.length > 0;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      history.back();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    document.documentElement.dataset.peekOpen = "";
    return () => {
      delete document.documentElement.dataset.peekOpen;
    };
  }, [isOpen]);

  // Focus stays inside the portal. Not `inert` on everything else: the portal's siblings are
  // Astro's — .aura, PhysicsBackground's canvas, Nav, <main> — and one that mounts later would
  // silently escape the enumeration. Lower PANELS are inert, because those we own (PeekPanel).
  useEffect(() => {
    if (!isOpen) return;
    const onFocusIn = (event: FocusEvent) => {
      const root = rootRef.current;
      const target = event.target;
      if (!root || !(target instanceof Node) || root.contains(target)) return;
      const top = root.querySelector<HTMLElement>("[data-peek-top]");
      if (top) focusWithoutScroll(top);
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [isOpen]);

  /** Tab wraps inside the top panel rather than walking out into the page behind it. */
  const trapTab = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const top = rootRef.current?.querySelector<HTMLElement>("[data-peek-top]");
    if (!top) return;

    const items = [...top.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute("inert"));
    if (!items.length) {
      event.preventDefault();
      top.focus();
      return;
    }

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (!event.shiftKey && (active === last || active === top)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && (active === first || active === top)) {
      event.preventDefault();
      last.focus();
    }
  }, []);

  // Focus back to whatever opened the panel that just closed, as long as it is still on the page.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !isOpen) {
      const last = [...triggers.current.values()].pop();
      if (last?.isConnected) focusWithoutScroll(last);
      triggers.current.clear();
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div ref={rootRef} onKeyDown={trapTab} className="fixed inset-0 z-50 [--peek-w:min(36rem,calc(100vw-3rem))]">
      {/* One backdrop for the whole stack: N of them would compound the dimming per level, and
          there is only one modal context here however deep it goes. */}
      <div onClick={closeAll} className="absolute inset-0 bg-ink/20 backdrop-blur-[1px]" />

      {stack.map((entry, i) => (
        <Suspense key={entry.ref} fallback={null}>
          <PeekPanel
            entry={entry}
            depth={i}
            isTop={i === stack.length - 1}
            atomKinds={atomKinds}
            strings={strings}
            onDismiss={dismiss}
          />
        </Suspense>
      ))}
    </div>,
    document.body,
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/*
  peek.ts — what a peek panel is, decided without a browser and without Astro.

  The panel itself (src/components/topic/PeekHost.tsx) is a thin shell around this file: it owns
  the DOM and nothing else. Every question worth getting wrong — is this click ours, does this ref
  stack or navigate, what does the payload contain — is a pure function here, so it is tested in
  milliseconds in node instead of guessed at in jsdom.

  Nothing at module scope touches `document`. That is what lets the endpoint import this file at
  build time and the island import it in the browser.
*/

import type { Level, Locale } from "@/i18n";
import type { Block } from "@/lib/notes/model";
import { parseRef, peekUrl, refHref, refTargetId, type LinkTable } from "@/lib/notes/refs";

/* ————————————————————————————— the payload ————————————————————————————— */

/**
 * One document, as the peek endpoint serves it.
 *
 * Deliberately NOT TopicContent. That type carries `links` for the whole site — a few hundred
 * entries, built once per page (topicPages.ts) — plus `route` and `altHref`, none of which a panel
 * reads. Shipping it would put the site's entire link table inside every peek file.
 *
 * The anchor is not here either: it belongs to the request, not to the document. Two links to the
 * same file at different headings fetch the same JSON and scroll to different places.
 */
export type PeekDoc = {
  /** Echoed so the client can key its cache and check a response against what it asked for. */
  ref: string;
  kind: "level" | "atom";
  title: string;
  summary: string;
  level: Level;
  /** The full page this is a window onto — the ⤢ link. */
  href: string;
  /** False when the reader's language has no file and the default one is being shown. */
  translated: boolean;
  blocks: Block[];
  /** ONLY the refs reachable from `blocks`. A peek opened from inside a peek resolves out of this
   *  table, and the reachable set is by definition everything such a peek could ask for. */
  links: LinkTable;
  /** Atom id → its own page, so an atom card inside a panel links out like it does on the page. */
  atomHrefs: Record<string, string>;
  /** An atom's prerequisites, already resolved to links. */
  needs: { href: string; title: string }[];
};

/** The half of TopicContent a PeekDoc is made from — structural, so the real type fits as-is and
 *  this file never has to import one that reaches astro:content. */
export type PeekSource = {
  route: { kind: "level" | "atom"; level: Level; locale: string; translated: boolean };
  title: string;
  summary: string;
  blocks: Block[];
  links: LinkTable;
  atomHrefs: Record<string, string>;
  needs: { href: string; title: string }[];
};

/**
 * Cut a full page's content down to one panel's worth.
 *
 * `reachable` is every ref the blocks point at (render.ts's `allRefsIn`), raw and possibly
 * anchored; the table is keyed without anchors, so each one goes through the same parse the
 * resolver uses. Refs that resolve to nothing are simply absent, exactly as they are on the page:
 * an unresolvable ref renders as an inert label, and the build has already failed if it was a typo.
 */
export function projectPeek(
  source: PeekSource,
  reachable: string[],
  meta: { ref: string; href: string },
): PeekDoc {
  const links: LinkTable = {};
  for (const raw of reachable) {
    const ref = parseRef(raw);
    if (!ref) continue;
    const id = refTargetId(ref);
    const hit = source.links[id];
    if (hit) links[id] = hit;
  }

  return {
    ref: meta.ref,
    kind: source.route.kind,
    title: source.title,
    summary: source.summary,
    level: source.route.level,
    href: meta.href,
    translated: source.route.translated,
    blocks: source.blocks,
    links,
    atomHrefs: source.atomHrefs,
    needs: source.needs,
  };
}

/* ————————————————————————————— the bus ————————————————————————————— */

/** Where a peek request travels. A DOM event, not a module-level subscriber list: the callers are
 *  separate hydration roots (a KnowledgeGraph island, the host itself), and the document is the
 *  one thing every island provably shares no matter how the bundler splits them. */
export const PEEK_EVENT = "mathslice:peek";

export type PeekRequest = {
  /** The ref exactly as written, anchor included. */
  ref: string;
  /** What to show in the header before the fetch lands. */
  label?: string;
  /** Focus goes back here when the panel closes. */
  trigger?: HTMLElement | null;
};

/** Ask for a peek from anywhere. A no-op on the server and on a page with no host mounted, which
 *  is what keeps a caller from having to know whether one exists. */
export function openPeek(request: PeekRequest): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent<PeekRequest>(PEEK_EVENT, { detail: request }));
}

export function onPeekOpen(handler: (request: PeekRequest) => void): () => void {
  if (typeof document === "undefined") return () => {};
  const listener = (event: Event) => handler((event as CustomEvent<PeekRequest>).detail);
  document.addEventListener(PEEK_EVENT, listener);
  return () => document.removeEventListener(PEEK_EVENT, listener);
}

/* ————————————————————————————— the stack ————————————————————————————— */

/**
 * Deep enough to follow a thought, shallow enough to still know where you are. Past this the
 * trigger is left alone and the browser navigates, so the reader lands on a real page with a real
 * URL instead of a fifth panel they cannot see the edge of.
 */
export const MAX_PEEK_DEPTH = 4;

export type PeekStatus = "loading" | "ready" | "error";

/**
 * One open panel.
 *
 * No `depth` field: depth is the index in the array, and a stored copy goes stale the instant a
 * truncate lands. `ref` and `targetId` are both here on purpose — `ref` keeps the anchor, because
 * two links into the same document at different headings are different destinations; `targetId`
 * drops it, because a document may not contain a peek of itself at ANY anchor.
 */
export type PeekEntry = {
  ref: string;
  targetId: string;
  /** Where the JSON comes from — also the cache key. */
  url: string;
  /** Heading or atom id to scroll to once painted. */
  anchor: string | null;
  /** Known before the fetch, so the header is never empty. */
  label: string;
  /** The full page — the ⤢ link, live in every status including error. */
  href: string;
  status: PeekStatus;
  doc: PeekDoc | null;
  /** Null once a popstate rebuilt the entry: the element that opened it is long gone. */
  trigger: HTMLElement | null;
};

/** Everything the entry can be built from before anything is fetched. */
export function peekEntry(request: PeekRequest, locale: Locale): PeekEntry | null {
  const ref = parseRef(request.ref);
  if (!ref) return null;

  return {
    ref: request.ref,
    targetId: refTargetId(ref),
    url: peekUrl(ref, locale),
    anchor: ref.kind === "level" ? ref.anchor : null,
    label: request.label?.trim() || "",
    href: refHref(ref, locale),
    status: "loading",
    doc: null,
    trigger: request.trigger ?? null,
  };
}

export type PeekDecision =
  | { kind: "push" }
  | { kind: "navigate"; why: "unparseable" | "cycle" | "depth" };

/**
 * Stack it, or let the browser have the click.
 *
 * Every "no" is a navigation, never a dead end: the trigger is a real `<a href>`, so declining to
 * intercept lands the reader on the same content as a whole page. That is why this returns a
 * decision instead of a boolean — the caller must not call preventDefault() before asking.
 */
export function decidePeek(stack: PeekEntry[], targetId: string | null): PeekDecision {
  if (!targetId) return { kind: "navigate", why: "unparseable" };
  if (stack.some((e) => e.targetId === targetId)) return { kind: "navigate", why: "cycle" };
  if (stack.length >= MAX_PEEK_DEPTH) return { kind: "navigate", why: "depth" };
  return { kind: "push" };
}

/** The shape of a click, minus the DOM — so the predicate below is testable in node. */
export type ClickLike = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  /** The ref carried by the nearest `[data-peek-ref]` ancestor, if any. */
  peekRef: string | null;
  /** The `target` attribute of the anchor, if any. */
  linkTarget: string | null;
};

/**
 * Is this click ours?
 *
 * Everything a browser already does well is left alone: a modified click opens a tab, a
 * middle-click opens a tab, `target="_blank"` opens a window, and a click something else already
 * handled stays handled. The peek only claims the plain left click on a peek trigger — the one
 * case where staying on the page is better than leaving it.
 */
export function shouldPeek(click: ClickLike): string | null {
  if (click.defaultPrevented) return null;
  if (click.button !== 0) return null;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return null;
  if (click.linkTarget && click.linkTarget !== "_self") return null;
  return click.peekRef || null;
}

export type PeekAction =
  | { type: "push"; entry: PeekEntry }
  | { type: "loaded"; ref: string; doc: PeekDoc }
  | { type: "failed"; ref: string }
  | { type: "truncate"; length: number };

/**
 * The stack, as a function of what happened to it.
 *
 * `loaded` and `failed` are no-ops when their ref is no longer where they left it. That single
 * rule is the whole stale-response guard: a fetch that resolves after the reader has already
 * closed or replaced the panel updates nothing, with no AbortController and no cleanup race.
 */
export function peekReducer(stack: PeekEntry[], action: PeekAction): PeekEntry[] {
  switch (action.type) {
    case "push":
      return [...stack, action.entry];

    case "truncate":
      return action.length >= stack.length ? stack : stack.slice(0, Math.max(0, action.length));

    case "loaded":
    case "failed": {
      const at = stack.findIndex((e) => e.ref === action.ref && e.status === "loading");
      if (at === -1) return stack;
      const settled: PeekEntry =
        action.type === "loaded"
          ? { ...stack[at], status: "ready", doc: action.doc }
          : { ...stack[at], status: "error", doc: null };
      return stack.map((entry, i) => (i === at ? settled : entry));
    }
  }
}

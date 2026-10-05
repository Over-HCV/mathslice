/*
  pieces — the markup of a rendered block, with no host in it.

  Both hosts of src/lib/notes/render.ts draw from this file: BlockView.tsx (the editor's read mode
  and the peek panel) and BlockRenderer.astro (the published page). Everything here is zero-JS by
  construction — Astro renders these without a `client:` directive and ships static HTML, exactly
  as Latex.tsx already documents. Anything that NEEDS the browser (MathRunner, CodeRunner, the
  artifacts) is wired by the hosts instead, because only Astro can decide per block whether to
  hydrate.

  So: if a heading, an atom card or a ref link looks different on the site than in the editor, the
  fix belongs here and nowhere else.
*/

import type { ReactNode, MouseEvent as ReactMouseEvent } from "react";
import Markdown from "react-markdown";

import { ATOM_REF_TAG, REHYPE_PLUGINS, REMARK_PLUGINS } from "@/lib/notes/markdown";

/** Turns a ref into something to navigate to. Absent means refs render as inert labels — which is
 *  what the editor wants, since a document being written may point at an atom nobody wrote yet. */
export type RefResolver = (ref: string) => { href: string; title: string } | null;

/* ————————————————————————————— prose ————————————————————————————— */

export function Prose({
  content,
  onClick,
  resolveRef,
}: {
  content: string;
  onClick?: (e: ReactMouseEvent<HTMLElement>) => void;
  resolveRef?: RefResolver;
}) {
  return (
    <div onClick={onClick} className={`reading [&_*]:my-0 [&_p]:my-0 ${onClick ? "cursor-text" : ""}`}>
      {content.trim() ? (
        <Markdown
          remarkPlugins={REMARK_PLUGINS}
          rehypePlugins={REHYPE_PLUGINS}
          components={markdownComponents(resolveRef)}
        >
          {content}
        </Markdown>
      ) : (
        <span className="text-ink-muted/50">…</span>
      )}
    </div>
  );
}

/** Inline `<Atom ref>` inside a sentence, produced by the remarkAtomRef plugin. */
const markdownComponents = (resolveRef?: RefResolver) =>
  ({
    [ATOM_REF_TAG]: ({ ref: refPath, label }: { ref?: string; label?: string }) =>
      refPath ? (
        <a
          href={resolveRef?.(refPath)?.href}
          data-peek-ref={refPath}
          className="text-primary underline decoration-dotted"
        >
          {label || refPath}
        </a>
      ) : null,
  }) as never;

/* ———————————————————————————— headings ———————————————————————————— */

const HEADING_CLASS: Record<number, string> = {
  1: "font-display text-3xl font-semibold text-ink",
  2: "font-display text-2xl font-semibold text-ink",
  3: "font-display text-xl font-semibold text-ink",
};

export function Heading({
  level,
  anchor,
  onClick,
  children,
}: {
  level: number;
  anchor: string;
  onClick?: (e: ReactMouseEvent<HTMLElement>) => void;
  children: ReactNode;
}) {
  // The tag follows the document's own hierarchy so screen readers and the outline agree with what
  // is written; the editor's `## ` shorthand still lands on h2, which is what it always produced.
  const Tag = `h${Math.min(Math.max(level, 1), 6)}` as unknown as "h2";
  return (
    <Tag
      id={anchor}
      onClick={onClick}
      className={`scroll-mt-24 ${HEADING_CLASS[level] ?? HEADING_CLASS[3]} ${onClick ? "cursor-text" : ""}`}
    >
      {children}
    </Tag>
  );
}

/* ————————————————————————————— atoms ————————————————————————————— */

/** The card an atom is drawn as. `id` is the anchor an `#…` ref lands on. */
export function AtomShell({
  atomId,
  kindLabel,
  label,
  href,
  children,
}: {
  atomId: string;
  kindLabel: string;
  label: string;
  /** Set on a page, absent in the editor: an atom is also a page of its own. */
  href?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={atomId}
      className="my-4 scroll-mt-24 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3"
    >
      <p className="mb-2 flex items-baseline gap-2 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-muted">
        <span className="text-accent">{kindLabel}</span>
        {href ? (
          <a href={href} className="no-underline hover:text-ink">
            {label || atomId}
          </a>
        ) : (
          <span>{label || atomId}</span>
        )}
      </p>
      {children}
    </section>
  );
}

/* ————————————————————————————— refs ————————————————————————————— */

/** A ref the reader can follow. `data-peek-ref` is what the peek host listens for; the href is a
 *  real URL, so cmd-click, middle-click and a page with no JS all keep working. */
export function RefCard({
  refKind,
  refPath,
  label,
  resolve,
}: {
  refKind: "embed" | "atomref";
  refPath: string;
  label: string;
  resolve?: RefResolver;
}) {
  const target = resolve?.(refPath) ?? null;
  const text = label || target?.title || refPath;

  if (refKind === "atomref" && label) {
    return (
      <a href={target?.href} data-peek-ref={refPath} className="text-primary underline decoration-dotted">
        {text}
      </a>
    );
  }

  return (
    <a
      href={target?.href}
      data-peek-ref={refPath}
      className="my-3 flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 no-underline transition-colors hover:border-primary"
    >
      <span aria-hidden className="font-mono text-ink-muted">
        ↳
      </span>
      <span className="min-w-0">
        <span className="block truncate text-ink">{text}</span>
        {!target && <span className="block truncate font-mono text-[11px] text-ink-muted">{refPath}</span>}
      </span>
    </a>
  );
}

/* ———————————————————————— code that is not run ———————————————————————— */

/** Until LeanProof lands, a lean fence still has to show its code and say plainly that nothing has
 *  checked it — invariant 3 of engine/architecture/03-lean-verification.md: unverified is marked,
 *  never hidden. */
export function LeanBlock({ code, theorem }: { code: string; theorem: string | null }) {
  return (
    <div className="my-3 overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface">
      <p className="border-b border-border px-3 py-1.5 font-mono text-[11px] text-ink-muted">
        lean{theorem ? ` · ${theorem}` : " · sin verificar"}
      </p>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-sm text-ink">{code}</pre>
    </div>
  );
}

export function ArtifactError({ name, error }: { name: string; error: string }) {
  return (
    <p className="my-3 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 font-mono text-xs text-ink-muted">
      <span className="text-accent">{name}</span> — {error}
    </p>
  );
}

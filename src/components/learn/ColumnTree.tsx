import { useEffect, useMemo, useRef, useState } from "react";
import type { TreeNode } from "@/lib/mathsTree";

/*
  ColumnTree — a macOS-Finder / Miller-columns browser for the media/maths tree, with a
  cybernetic look and PERSPECTIVE recession: the most-recently-opened column (rightmost) is at
  full size; each column to its left shrinks + fades, so no matter how deep you drill it never
  runs out of horizontal room. Rectangular glass pills (long labels fit); orthogonal "circuit"
  connectors; everything grid-aligned. Click a node to open its children as the next column;
  click a leaf with a published topic to open it. Horizontal-scroll/drag to walk back.
*/

type Props = { tree: TreeNode; soonLabel: string; hintLabel: string };

const COL_W = 200; // base column width (px) at full scale
const SCALE_STEP = 0.82; // each step left recedes by this factor
const MIN_SCALE = 0.4;

export default function ColumnTree({ tree, soonLabel, hintLabel }: Props) {
  const byId = useRef(new Map<string, TreeNode>());
  if (byId.current.size === 0) {
    const walk = (n: TreeNode) => {
      byId.current.set(n.slug, n);
      n.children.forEach(walk);
    };
    walk(tree);
  }

  // path[k] = the selected node id in column k. path[0] is always the root.
  const [path, setPath] = useState<string[]>([tree.slug]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const pillEls = useRef(new Map<string, HTMLElement>());
  const pathEls = useRef(new Map<string, SVGPathElement>());

  // Build the visible columns from the active path.
  const columns = useMemo(() => {
    const cols: TreeNode[][] = [[tree]];
    for (let k = 1; k <= path.length; k++) {
      const parent = byId.current.get(path[k - 1]);
      if (parent && parent.children.length) cols.push(parent.children);
      else break;
    }
    return cols;
  }, [path, tree]);

  const active = columns.length - 1;
  const scaleOf = (col: number) => Math.max(MIN_SCALE, Math.pow(SCALE_STEP, active - col));

  // Connector links: parent (path[k-1]) → each child in column k.
  const links = useMemo(() => {
    const out: { parent: string; child: string; col: number; onPath: boolean }[] = [];
    for (let k = 1; k < columns.length; k++) {
      const parent = path[k - 1];
      for (const child of columns[k]) {
        out.push({ parent, child: child.slug, col: k, onPath: path[k] === child.slug });
      }
    }
    return out;
  }, [columns, path]);

  const onPick = (id: string, col: number) => {
    const node = byId.current.get(id)!;
    if (node.children.length) {
      setPath((prev) => [...prev.slice(0, col), id]);
    } else if (node.hasContent && node.href) {
      window.location.href = node.href;
    } else {
      setPath((prev) => [...prev.slice(0, col), id]); // select the leaf (highlights it)
    }
  };

  // Keep the newest (right) column in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  }, [path]);

  // Draw the orthogonal connectors from measured pill rects (rAF → always correct through
  // transitions/scroll). Cheap: a handful of columns.
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const base = contentRef.current;
      if (base) {
        const b = base.getBoundingClientRect();
        for (const l of links) {
          const p = pillEls.current.get(l.parent);
          const c = pillEls.current.get(l.child);
          const path = pathEls.current.get(`${l.parent}->${l.child}`);
          if (!p || !c || !path) continue;
          const pr = p.getBoundingClientRect();
          const cr = c.getBoundingClientRect();
          const x1 = pr.right - b.left;
          const y1 = pr.top + pr.height / 2 - b.top;
          const x2 = cr.left - b.left;
          const y2 = cr.top + cr.height / 2 - b.top;
          const mx = x1 + Math.max(14, (x2 - x1) * 0.5);
          path.setAttribute("d", `M ${x1} ${y1} H ${mx} V ${y2} H ${x2}`);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [links]);

  return (
    <div
      className="relative h-[70vh] min-h-[460px] w-full overflow-hidden rounded-[var(--radius)]"
    >
      <p className="pointer-events-none absolute left-1 top-1 z-20 max-w-xs font-mono text-xs leading-relaxed text-ink-muted">
        {hintLabel}
      </p>

      <div
        ref={scrollRef}
        className="hide-scrollbar h-full w-full overflow-x-auto overflow-y-hidden"
      >
        <div ref={contentRef} className="relative flex h-full min-w-max items-center gap-8 px-10">
          {/* connectors overlay */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            {links.map((l) => (
              <path
                key={`${l.parent}->${l.child}`}
                ref={(el) => {
                  if (el) pathEls.current.set(`${l.parent}->${l.child}`, el);
                  else pathEls.current.delete(`${l.parent}->${l.child}`);
                }}
                fill="none"
                stroke={l.onPath ? "var(--c-primary)" : "var(--c-border)"}
                strokeWidth={l.onPath ? 1.8 : 1}
                opacity={scaleOf(l.col) * (l.onPath ? 1 : 0.7)}
              />
            ))}
          </svg>

          {columns.map((col, k) => {
            const s = scaleOf(k);
            return (
              <div
                key={k}
                className="relative z-10 flex shrink-0 flex-col justify-center"
                style={{ width: COL_W * s, gap: 10 * s }}
              >
                {col.map((node) => {
                  const selected = path[k] === node.slug;
                  const openable = node.children.length > 0;
                  const readable = node.isLeaf && node.hasContent;
                  return (
                    <button
                      key={node.slug}
                      ref={(el) => {
                        if (el) pillEls.current.set(node.slug, el);
                        else pillEls.current.delete(node.slug);
                      }}
                      onClick={() => onPick(node.slug, k)}
                      title={node.isLeaf && !node.hasContent ? soonLabel : node.name}
                      className={`glass group relative flex items-center gap-2 rounded-[calc(var(--radius)*0.6)] text-left transition-all duration-300 ${
                        selected ? "ring-2 ring-primary" : ""
                      } ${node.isLeaf && !node.hasContent ? "opacity-55" : ""}`}
                      style={{
                        padding: `${10 * s}px ${12 * s}px`,
                        minHeight: 44 * s,
                      }}
                    >
                      {/* port dot (cybernetic) */}
                      <span
                        className="shrink-0 rounded-full"
                        style={{
                          width: 6 * s,
                          height: 6 * s,
                          background: readable
                            ? "var(--c-accent)"
                            : openable
                              ? "var(--c-primary)"
                              : "var(--c-ink-muted)",
                        }}
                      />
                      <span
                        className={`flex-1 leading-tight ${k === 0 ? "font-display font-semibold text-ink" : "text-ink"}`}
                        style={{ fontSize: (k === 0 ? 15 : 13) * s }}
                      >
                        {node.name}
                      </span>
                      {openable && (
                        <span className="shrink-0 text-ink-muted" style={{ fontSize: 12 * s }}>
                          ›
                        </span>
                      )}
                      {readable && (
                        <span
                          className="shrink-0 font-mono uppercase tracking-wider text-accent"
                          style={{ fontSize: 8 * s }}
                        >
                          abrir
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

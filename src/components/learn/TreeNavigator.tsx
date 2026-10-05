import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TreeNode } from "@/lib/mathsTree";

/*
  TreeNavigator — browse the media/maths topic tree as glassmorphic "bolitas". Layout is a tidy
  (Reingold–Tilford) tree so nodes NEVER overlap; positions ease toward their targets so expanding
  animates smoothly. A parallax offset by depth gives a 2.5D feel as you move the mouse.
  Interactions: scroll over a branch to reveal/collapse it a level at a time; click a leaf with a
  published topic to open it; drag the background to pan; wheel over empty space to zoom.
*/

type Props = { tree: TreeNode; soonLabel: string; hintLabel: string };
type Pos = { x: number; y: number; tx: number; ty: number; depth: number; phase: number };

const X_GAP = 96;
const Y_GAP = 132;
const sizeForDepth = (d: number) => (d === 0 ? 74 : d === 1 ? 60 : d === 2 ? 48 : 40);

export default function TreeNavigator({ tree, soonLabel, hintLabel }: Props) {
  const nodeById = useRef(new Map<string, TreeNode>());
  if (nodeById.current.size === 0) {
    const walk = (n: TreeNode) => {
      nodeById.current.set(n.slug, n);
      n.children.forEach(walk);
    };
    walk(tree);
  }

  const [open, setOpen] = useState<Set<string>>(() => new Set([tree.slug]));
  const openRef = useRef(open);
  openRef.current = open;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const pos = useRef(new Map<string, Pos>());
  const nodeEls = useRef(new Map<string, HTMLElement>());
  const lineEls = useRef(new Map<string, SVGLineElement>());
  const view = useRef({ px: 0, py: 0, zoom: 1 });
  const drag = useRef({ pan: false, moved: 0, downId: "" as string, lastX: 0, lastY: 0 });
  const mouse = useRef({ nx: 0, ny: 0, sx: 0, sy: 0 }); // normalized + smoothed for parallax

  // ——— open-set helpers (explicit set → no stale closures) ———
  const visibleFrom = (openSet: Set<string>): string[] => {
    const out: string[] = [];
    const rec = (id: string) => {
      out.push(id);
      if (openSet.has(id)) nodeById.current.get(id)!.children.forEach((c) => rec(c.slug));
    };
    rec(tree.slug);
    return out;
  };
  const subtree = (rootId: string, openSet: Set<string>): string[] => {
    const out: string[] = [];
    const rec = (id: string) => {
      out.push(id);
      if (openSet.has(id)) nodeById.current.get(id)!.children.forEach((c) => rec(c.slug));
    };
    rec(rootId);
    return out;
  };
  const linksFrom = (openSet: Set<string>): [string, string][] => {
    const links: [string, string][] = [];
    for (const id of visibleFrom(openSet))
      if (openSet.has(id))
        for (const c of nodeById.current.get(id)!.children) links.push([id, c.slug]);
    return links;
  };

  const expandLevel = (rootId: string) =>
    setOpen((prev) => {
      const cands = subtree(rootId, prev).filter(
        (id) => nodeById.current.get(id)!.children.length > 0 && !prev.has(id),
      );
      if (!cands.length) return prev;
      const minD = Math.min(...cands.map((id) => nodeById.current.get(id)!.depth));
      const next = new Set(prev);
      cands.filter((id) => nodeById.current.get(id)!.depth === minD).forEach((id) => next.add(id));
      return next;
    });
  const collapseLevel = (rootId: string) =>
    setOpen((prev) => {
      const opened = subtree(rootId, prev).filter((id) => prev.has(id) && id !== tree.slug);
      if (!opened.length) return prev;
      const maxD = Math.max(...opened.map((id) => nodeById.current.get(id)!.depth));
      const next = new Set(prev);
      opened.filter((id) => nodeById.current.get(id)!.depth === maxD).forEach((id) => next.delete(id));
      return next;
    });
  const toggle = (id: string) =>
    setOpen((prev) => {
      if (!nodeById.current.get(id)!.children.length) return prev;
      const next = new Set(prev);
      if (next.has(id)) subtree(id, prev).forEach((d) => next.delete(d));
      else next.add(id);
      return next;
    });

  // Tidy-tree layout → target positions (no overlap by construction).
  const relayout = (openSet: Set<string>) => {
    let leaf = 0;
    const targets = new Map<string, { tx: number; ty: number; depth: number }>();
    const place = (node: TreeNode): number => {
      const isOpen = openSet.has(node.slug) && node.children.length > 0;
      let x: number;
      if (isOpen) {
        const xs = node.children.map(place);
        x = (xs[0] + xs[xs.length - 1]) / 2;
      } else {
        x = leaf * X_GAP;
        leaf++;
      }
      targets.set(node.slug, { tx: x, ty: node.depth * Y_GAP, depth: node.depth });
      return x;
    };
    place(tree);
    const xs = [...targets.values()].map((t) => t.tx);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;

    const ids = new Set(targets.keys());
    for (const [id, t] of targets) {
      const tx = t.tx - mid;
      const existing = pos.current.get(id);
      if (existing) {
        existing.tx = tx;
        existing.ty = t.ty;
      } else {
        // new node drops in from its parent's current spot
        const parentId = id.includes("/") ? id.slice(0, id.lastIndexOf("/")) : "";
        const p = pos.current.get(parentId);
        pos.current.set(id, {
          x: p ? p.x : tx,
          y: p ? p.y : t.ty,
          tx,
          ty: t.ty,
          depth: t.depth,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
    for (const id of [...pos.current.keys()]) if (!ids.has(id)) pos.current.delete(id);
  };

  useLayoutEffect(() => {
    relayout(open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const stage = stageRef.current!;
    let raf = 0;
    let t = 0;
    const readMotion = () => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue("--motion-level").trim();
      const v = parseFloat(raw);
      return raw === "" || Number.isNaN(v) ? 1 : Math.max(0, Math.min(1, v));
    };

    const step = () => {
      t += 1;
      const m = readMotion();
      // smooth the parallax mouse
      mouse.current.sx += (mouse.current.nx - mouse.current.sx) * 0.06;
      mouse.current.sy += (mouse.current.ny - mouse.current.sy) * 0.06;

      for (const [, p] of pos.current) {
        p.x += (p.tx - p.x) * 0.14;
        p.y += (p.ty - p.y) * 0.14;
      }

      const { px, py, zoom } = view.current;
      if (worldRef.current)
        worldRef.current.style.transform = `translate(${px}px, ${py}px) scale(${zoom})`;

      for (const [id, el] of nodeEls.current) {
        const p = pos.current.get(id);
        if (!p) continue;
        // parallax: deeper nodes shift more with the mouse (2.5D); tiny idle sway
        const par = 6 + p.depth * 7;
        const sway = m * 3 * Math.sin(t * 0.02 + p.phase);
        const rx = p.x + mouse.current.sx * par + sway;
        const ry = p.y + mouse.current.sy * par * 0.5;
        el.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      }
      for (const [key, line] of lineEls.current) {
        const [pid, cid] = key.split("→");
        const a = pos.current.get(pid);
        const c = pos.current.get(cid);
        if (a && c) {
          const pa = 6 + a.depth * 7;
          const pc = 6 + c.depth * 7;
          line.setAttribute("x1", String(a.x + mouse.current.sx * pa));
          line.setAttribute("y1", String(a.y + mouse.current.sy * pa * 0.5));
          line.setAttribute("x2", String(c.x + mouse.current.sx * pc));
          line.setAttribute("y2", String(c.y + mouse.current.sy * pc * 0.5));
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const onParallax = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      mouse.current.nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      mouse.current.ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    const onDown = (e: PointerEvent) => {
      const target = (e.target as HTMLElement).closest("[data-node]") as HTMLElement | null;
      drag.current.moved = 0;
      drag.current.lastX = e.clientX;
      drag.current.lastY = e.clientY;
      drag.current.downId = target ? target.dataset.node! : "";
      drag.current.pan = !target;
      stage.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      onParallax(e);
      drag.current.moved += Math.abs(e.clientX - drag.current.lastX) + Math.abs(e.clientY - drag.current.lastY);
      if (drag.current.pan) {
        view.current.px += e.clientX - drag.current.lastX;
        view.current.py += e.clientY - drag.current.lastY;
      }
      drag.current.lastX = e.clientX;
      drag.current.lastY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (drag.current.downId && drag.current.moved < 6) {
        const node = nodeById.current.get(drag.current.downId)!;
        if (node.isLeaf && node.href) window.location.href = node.href;
        else toggle(drag.current.downId);
      }
      drag.current.downId = "";
      drag.current.pan = false;
      try {
        stage.releasePointerCapture(e.pointerId);
      } catch {}
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const target = (e.target as HTMLElement).closest("[data-node]") as HTMLElement | null;
      if (target) {
        if (e.deltaY > 0) expandLevel(target.dataset.node!);
        else collapseLevel(target.dataset.node!);
      } else {
        const f = e.deltaY > 0 ? 0.92 : 1.08;
        view.current.zoom = Math.max(0.4, Math.min(2.2, view.current.zoom * f));
      }
    };

    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ids = visibleFrom(open);
  const links = linksFrom(open);

  return (
    <div
      ref={stageRef}
      className="relative h-[70vh] min-h-[460px] w-full touch-none select-none overflow-hidden rounded-[var(--radius)]"
    >
      <p className="pointer-events-none absolute left-1 top-1 z-10 max-w-xs font-mono text-xs leading-relaxed text-ink-muted">
        {hintLabel}
      </p>

      <div ref={worldRef} className="absolute left-1/2 top-[96px] origin-top-left will-change-transform">
        <svg className="absolute overflow-visible" style={{ left: 0, top: 0 }} aria-hidden>
          {links.map(([p, c]) => (
            <line
              key={`${p}→${c}`}
              ref={(el) => {
                if (el) lineEls.current.set(`${p}→${c}`, el);
                else lineEls.current.delete(`${p}→${c}`);
              }}
              stroke="var(--c-border)"
              strokeWidth={1.5}
            />
          ))}
        </svg>

        {ids.map((id) => {
          const node = nodeById.current.get(id)!;
          const s = sizeForDepth(node.depth);
          const clickable = node.isLeaf && node.hasContent;
          const isGroup = node.depth <= 1;
          return (
            <div
              key={id}
              data-node={id}
              ref={(el) => {
                if (el) nodeEls.current.set(id, el);
                else nodeEls.current.delete(id);
              }}
              title={node.isLeaf && !node.hasContent ? soonLabel : node.name}
              className={`glass absolute flex cursor-pointer items-center justify-center rounded-full text-center leading-tight transition-shadow hover:shadow-lg ${
                clickable ? "ring-1 ring-primary/50" : ""
              } ${node.isLeaf && !node.hasContent ? "opacity-55" : ""}`}
              style={{ width: s, height: s, left: 0, top: 0 }}
            >
              <span
                className={`px-1 ${isGroup ? "text-ink" : "text-ink-muted"} ${
                  node.depth === 0 ? "font-display font-semibold" : ""
                }`}
                style={{ fontSize: node.depth === 0 ? 13 : node.depth === 1 ? 11 : 9 }}
              >
                {node.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

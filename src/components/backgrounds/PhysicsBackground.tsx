import { useEffect, useRef } from "react";
import type { BackgroundMotif } from "@/lib/identity";

/*
  PhysicsBackground — a live, low-amplitude canvas simulation behind content. Not a video, not
  scripted: each variant is a small numerical sim so motion reads as physical. Two jobs:
    1. Ambient motion + a distinct MOUSE interaction per motif (repel / deform / vortex / attract).
    2. A luminous glow layer (soft drifting blobs) so the glass surfaces on top always have bright,
       out-of-focus content to refract — the missing ingredient that makes glass look real.

  Motion is scaled by the --motion-level token (0 off · 0.5 calm · 1 full). Under OS reduce-motion
  the CSS default is 0.5 (calm) — never a dead frozen frame unless the user explicitly picks "off".
*/

type Props = {
  variant: BackgroundMotif;
  opacity?: number;
  className?: string;
  /** Fill the positioned parent (lab preview) instead of the viewport. */
  bounded?: boolean;
};

type P = { x: number; y: number; vx: number; vy: number };

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
const smooth = (t: number) => t * t * (3 - 2 * t);
function noise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = smooth(xf);
  const v = smooth(yf);
  return (
    hash(xi, yi) * (1 - u) * (1 - v) +
    hash(xi + 1, yi) * u * (1 - v) +
    hash(xi, yi + 1) * (1 - u) * v +
    hash(xi + 1, yi + 1) * u * v
  );
}

export default function PhysicsBackground({
  variant,
  opacity = 0.5,
  className = "",
  bounded = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;

    let cPrimary = "oklch(0.55 0.15 265)";
    let cAccent = "oklch(0.7 0.14 65)";
    let motion = 1; // effective --motion-level
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      cPrimary = cs.getPropertyValue("--c-primary").trim() || cPrimary;
      cAccent = cs.getPropertyValue("--c-accent").trim() || cAccent;
      const raw = cs.getPropertyValue("--motion-level").trim();
      const v = parseFloat(raw);
      motion = raw === "" || Number.isNaN(v) ? 1 : Math.max(0, Math.min(1, v));
    };

    // Pointer in canvas space + activity that decays when the mouse stops.
    const mouse = { x: -1e4, y: -1e4, act: 0 };
    const onPointer = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.act = 1;
    };

    let particles: P[] = [];
    let nodes: (P & { hx: number; hy: number })[] = [];
    let cols = 0;
    let rows = 0;
    const spacing = 48;

    const seed = () => {
      if (variant === "constellation" || variant === "field") {
        const n =
          variant === "constellation"
            ? Math.min(90, Math.round((w * h) / 22000))
            : Math.min(220, Math.round((w * h) / 7000));
        particles = Array.from({ length: n }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
        }));
      }
      if (variant === "lattice") {
        cols = Math.ceil(w / spacing) + 2;
        rows = Math.ceil(h / spacing) + 2;
        nodes = [];
        for (let j = 0; j < rows; j++)
          for (let i = 0; i < cols; i++) {
            const hx = i * spacing;
            const hy = j * spacing;
            nodes.push({ x: hx, y: hy, vx: 0, vy: 0, hx, hy });
          }
      }
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    let t = 0;
    // Soft color behind the glass is now a STATIC CSS aura (Base .aura) — zero per-frame cost,
    // instead of drawing radial-gradient glows every frame on every section.

    const stepConstellation = () => {
      const R = 150;
      for (const p of particles) {
        p.x += p.vx * motion;
        p.y += p.vy * motion;
        // repel from cursor
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (mouse.act > 0.01 && d2 < R * R) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / R) * 1.2 * mouse.act;
          p.x += (dx / d) * f;
          p.y += (dy / d) * f;
        }
        if (p.x < 0) p.x += w;
        else if (p.x > w) p.x -= w;
        if (p.y < 0) p.y += h;
        else if (p.y > h) p.y -= h;
      }
    };
    const drawConstellation = () => {
      const R = 130;
      ctx.lineWidth = 1;
      ctx.strokeStyle = cPrimary;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R * R) {
            ctx.globalAlpha = (1 - Math.sqrt(d2) / R) * 0.5 * opacity;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      // brighter links to the cursor
      if (mouse.act > 0.01) {
        ctx.strokeStyle = cAccent;
        const R2 = 170;
        for (const p of particles) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d = Math.hypot(dx, dy);
          if (d < R2) {
            ctx.globalAlpha = (1 - d / R2) * 0.6 * opacity * mouse.act;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = opacity;
      ctx.fillStyle = cAccent;
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const stepField = () => {
      const scale = 0.0016;
      for (const p of particles) {
        const ang = noise2(p.x * scale, p.y * scale + t * 0.05) * Math.PI * 4;
        p.vx = p.vx * 0.92 + Math.cos(ang) * 0.06;
        p.vy = p.vy * 0.92 + Math.sin(ang) * 0.06;
        // vortex: bend flow toward the cursor
        if (mouse.act > 0.01) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d < 220) {
            const f = (1 - d / 220) * 0.5 * mouse.act;
            p.vx += (dx / (d || 1)) * f;
            p.vy += (dy / (d || 1)) * f;
          }
        }
        p.x += p.vx * motion;
        p.y += p.vy * motion;
        if (p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
          p.x = Math.random() * w;
          p.y = Math.random() * h;
          p.vx = p.vy = 0;
        }
      }
    };
    const drawField = () => {
      ctx.globalAlpha = 0.55 * opacity;
      ctx.strokeStyle = cPrimary;
      ctx.lineWidth = 1.1;
      for (const p of particles) {
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * 6, p.y - p.vy * 6);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const stepLattice = () => {
      const scale = 0.006;
      const R = 150;
      for (const n of nodes) {
        const nx = noise2(n.hx * scale + t * 0.01, n.hy * scale) - 0.5;
        const ny = noise2(n.hx * scale, n.hy * scale + t * 0.01 + 10) - 0.5;
        let tx = n.hx + nx * spacing * 0.9 * motion;
        let ty = n.hy + ny * spacing * 0.9 * motion;
        // deform: push nodes radially outward from the cursor (a moving bulge/lens)
        if (mouse.act > 0.01) {
          const dx = n.hx - mouse.x;
          const dy = n.hy - mouse.y;
          const d = Math.hypot(dx, dy);
          if (d < R) {
            const f = (1 - d / R) * 26 * mouse.act;
            tx += (dx / (d || 1)) * f;
            ty += (dy / (d || 1)) * f;
          }
        }
        n.x += (tx - n.x) * 0.08;
        n.y += (ty - n.y) * 0.08;
      }
    };
    const drawLattice = () => {
      ctx.globalAlpha = 0.4 * opacity;
      ctx.strokeStyle = cPrimary;
      ctx.lineWidth = 1;
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const n = nodes[j * cols + i];
          if (i < cols - 1) {
            const r = nodes[j * cols + i + 1];
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(r.x, r.y);
            ctx.stroke();
          }
          if (j < rows - 1) {
            const d = nodes[(j + 1) * cols + i];
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(d.x, d.y);
            ctx.stroke();
          }
        }
      ctx.globalAlpha = 1;
    };

    const fluid = Array.from({ length: 5 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      phase: i * 1.7,
      sp: (0.06 + Math.random() * 0.05) / 8, // slow drift
    }));
    const drawFluid = () => {
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < fluid.length; i++) {
        const b = fluid[i];
        let cx = w * (0.5 + 0.4 * Math.cos(t * b.sp * motion + b.phase));
        let cy = h * (0.5 + 0.4 * Math.sin(t * b.sp * motion * 0.8 + b.phase * 1.3));
        // attract toward the cursor
        if (mouse.act > 0.01) {
          cx += (mouse.x - cx) * 0.25 * mouse.act;
          cy += (mouse.y - cy) * 0.25 * mouse.act;
        }
        const rad = Math.min(w, h) * 0.34;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, i % 2 === 0 ? cPrimary : cAccent);
        g.addColorStop(1, "transparent");
        ctx.globalAlpha = 0.14 * opacity;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    };

    const step = () => {
      t += 1;
      mouse.act *= 0.95; // decay when the mouse stops
      if (variant === "constellation") stepConstellation();
      else if (variant === "field") stepField();
      else if (variant === "lattice") stepLattice();
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      if (variant === "constellation") drawConstellation();
      else if (variant === "field") drawField();
      else if (variant === "lattice") drawLattice();
      else drawFluid();
    };

    let raf = 0;
    let running = true;
    // Cap to ~30fps — the sims read fine at 30 and it roughly halves CPU/GPU (idle-heat fix).
    const FRAME_MS = 1000 / 30;
    let lastT = 0;
    const frame = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (now - lastT < FRAME_MS) return;
      lastT = now;
      if (motion > 0) step();
      draw();
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };

    const observer = new MutationObserver(readTokens);

    readTokens();
    resize();
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "style"],
    });
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
    };
  }, [variant, opacity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none ${
        bounded ? "absolute inset-0 h-full" : "fixed inset-0 -z-20 h-dvh"
      } w-full ${className}`}
    />
  );
}

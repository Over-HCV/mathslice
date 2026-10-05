import { useEffect, useRef, useState } from "react";

/*
  DesmosGraph — embeds the official Desmos Graphing/3D Calculator API (loaded once, globally, via a
  <script> tag — Desmos ships no npm package). `expr` is Desmos/LaTeX syntax, one expression per
  line ("y=\\sin(x)\ny=\\cos(x)", or for 3D e.g. "z=\\sin(x)+\\cos(y)"), not JS — see graphEngine.ts.
  Selected as the default graphing engine (PLATFORM-ARCHITECTURE.md §4), swappable via GRAPH_ENGINE.

  API key: PUBLIC_DESMOS_API_KEY (get one free at desmos.com/my-api for production). Falls back to
  Desmos's own published demo key, meant for development only — do not ship the demo key.

  Toolbar (ours — Desmos has no built-in buttons for these): toggle the expressions panel, switch
  2D↔3D (Desmos.Calculator3D, a separate constructor sharing the same script/options — switching
  destroys and recreates the instance; live expressions carry over, not the viewport/camera — those
  aren't compatible across dimensions), and native browser fullscreen.

  Traceability: Desmos is itself the editor (you can add/drag/delete expressions straight in its
  panel) — so `expr`/`onContentChange` must be a two-way sync, not a one-time seed, or anything you
  add beyond the first expression is invisible outside the widget and gets wiped the moment
  something reseeds the calculator (switching dimension, editing the block's raw text, exporting).
  Every live change is serialized (one LaTeX line per expression) and pushed out via
  `onContentChange`, so `block.content` — and therefore export/import — always reflects the full
  graph, not just expression #1.
*/

type ExprState = { id: string; type?: string; latex?: string; [k: string]: unknown };
type CalcHandle = {
  setExpression: (e: { id: string; latex: string }) => void;
  getExpressions: () => ExprState[];
  removeExpressions: (ids: { id: string }[]) => void;
  setBlank: (opts?: { allowUndo?: boolean }) => void;
  updateSettings: (opts: Record<string, unknown>) => void;
  observeEvent: (name: "change", cb: () => void) => void;
  unobserveEvent: (name: "change") => void;
  destroy: () => void;
};

declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator: (el: HTMLElement, options?: Record<string, unknown>) => CalcHandle;
      Calculator3D: (el: HTMLElement, options?: Record<string, unknown>) => CalcHandle;
    };
    __desmosLoad?: Promise<void>;
  }
}

const DEMO_API_KEY = "dcb31709b452b1cf9dc26972add0fda6"; // Desmos's own public dev/test key

function loadDesmos(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Desmos) return Promise.resolve();
  if (window.__desmosLoad) return window.__desmosLoad;

  const apiKey = import.meta.env.PUBLIC_DESMOS_API_KEY || DEMO_API_KEY;
  window.__desmosLoad = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${apiKey}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Desmos"));
    document.head.appendChild(script);
  });
  return window.__desmosLoad;
}

/** One LaTeX expression per line — the export-native serialization of "everything in Desmos". */
function serializeExpressions(exprs: ExprState[]): string {
  return exprs
    .filter((e) => (e.type ?? "expression") === "expression" && typeof e.latex === "string" && e.latex.trim())
    .map((e) => e.latex!.trim())
    .join("\n");
}
function parseExprLines(content: string): string[] {
  return content
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function DesmosGraph({
  expr = "y=\\sin(x)",
  onContentChange,
}: {
  expr?: string;
  onContentChange?: (content: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const elRef = useRef<HTMLDivElement | null>(null);
  const calcRef = useRef<CalcHandle | null>(null);
  // Live expressions captured just before a 2D/3D swap destroys the instance, so switching
  // dimension carries over what you actually typed in Desmos — not the original seed prop. Only
  // the math content (id/latex) moves across, never the viewport/camera — those aren't compatible
  // between 2D and 3D and feeding a 2D getState() into Calculator3D.setState() just renders
  // "Error loading graph" with nothing shown, Desmos doesn't even throw so try/catch can't save it.
  const savedExprs = useRef<ExprState[] | null>(null);
  // The last content WE pushed out via onContentChange — when `expr` changes to exactly this, it's
  // an echo of our own sync, not an external edit, so the [expr] effect below must not re-seed the
  // calculator with it (would fight the user's cursor mid-edit inside Desmos's own panel).
  const lastEmitted = useRef<string | null>(null);
  const onContentChangeRef = useRef(onContentChange);
  useEffect(() => {
    onContentChangeRef.current = onContentChange;
  }, [onContentChange]);

  const [showExpressions, setShowExpressions] = useState(true);
  const [is3D, setIs3D] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // (Re)create the calculator whenever the 2D/3D engine choice flips.
  useEffect(() => {
    let cancelled = false;
    loadDesmos().then(() => {
      if (cancelled || !elRef.current || !window.Desmos) return;
      const make = is3D ? window.Desmos.Calculator3D : window.Desmos.GraphingCalculator;
      const calc = make(elRef.current, {
        keypad: false,
        // Settings menu (⚙) is how you reach Desmos's own "Complex Mode" toggle — it adds `i` as
        // the imaginary unit (real/imag/conj/arg/| |) instead of a plain variable. There's no
        // direct `complexMode` API flag to force it on (only `allowComplex`, which just permits
        // the toggle to exist — already true by default); the settings menu is the only way in.
        settingsMenu: true,
        expressionsTopbar: true, // Desmos's own collapse/expand chevron for the panel — keep it
        expressions: showExpressions,
        allowComplex: true,
        // Match the site's current theme by default (ThemeBoot.astro stamps [data-theme] on <html>
        // pre-paint). Set once at creation, not kept in sync live — if the user flips Desmos's own
        // inverted-colors toggle in its settings menu, we shouldn't fight that per-graph choice.
        invertedColors: document.documentElement.dataset.theme === "dark",
      });
      const restore = savedExprs.current?.filter((e) => typeof e.latex === "string" && e.latex.length);
      if (restore?.length) {
        for (const e of restore) calc.setExpression({ id: e.id, latex: e.latex! });
      } else {
        parseExprLines(expr).forEach((latex, i) => calc.setExpression({ id: `graph${i + 1}`, latex }));
      }

      // Keep block.content in sync with whatever is really in Desmos — adding/editing/dragging an
      // expression, deleting one, anything. Debounced: dragging a point fires 'change' constantly.
      let debounce: ReturnType<typeof setTimeout> | undefined;
      calc.observeEvent("change", () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          const serialized = serializeExpressions(calc.getExpressions());
          lastEmitted.current = serialized;
          onContentChangeRef.current?.(serialized);
        }, 250);
      });

      calcRef.current = calc;
    });
    return () => {
      cancelled = true;
      if (calcRef.current) {
        try {
          const exprs = calcRef.current.getExpressions();
          savedExprs.current = exprs;
          const serialized = serializeExpressions(exprs);
          lastEmitted.current = serialized;
          onContentChangeRef.current?.(serialized); // flush before a 2D/3D swap too, not just on unmount
        } catch {
          /* first mount, or Desmos not ready — nothing to save */
        }
        calcRef.current.unobserveEvent("change");
      }
      calcRef.current?.destroy();
      calcRef.current = null;
    };
    // Only the engine choice recreates the instance — expr/showExpressions update it in place below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is3D]);

  // An external edit (raw markdown text edited by hand, then compiled) — replace everything. Skip
  // when `expr` merely echoes what we just emitted ourselves (see lastEmitted above).
  useEffect(() => {
    if (!calcRef.current) return;
    if (lastEmitted.current === expr) return;
    const calc = calcRef.current;
    calc.setBlank({ allowUndo: false });
    parseExprLines(expr).forEach((latex, i) => calc.setExpression({ id: `graph${i + 1}`, latex }));
  }, [expr]);

  useEffect(() => {
    calcRef.current?.updateSettings({ expressions: showExpressions });
  }, [showExpressions]);

  // Native fullscreen on the outer container; Desmos autosizes but the transition needs a nudge.
  useEffect(() => {
    const onChange = () => {
      setFullscreen(document.fullscreenElement === wrapRef.current);
      setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrapRef.current?.requestFullscreen();
  };

  return (
    <div
      ref={wrapRef}
      className={`group/graph relative my-6 overflow-hidden rounded-[var(--radius-md)] border border-border ${
        fullscreen ? "bg-bg" : ""
      }`}
    >
      <div className="absolute top-3 right-12 z-10 flex gap-1 opacity-0 transition-opacity group-hover/graph:opacity-100">
        <button
          onClick={() => setShowExpressions((v) => !v)}
          aria-pressed={showExpressions}
          title={showExpressions ? "Ocultar ecuaciones" : "Mostrar ecuaciones"}
          className="rounded-[var(--radius-sm)] border border-border bg-surface/90 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-ink-muted backdrop-blur hover:text-ink"
        >
          Σ {showExpressions ? "on" : "off"}
        </button>
        <button
          onClick={() => setIs3D((v) => !v)}
          aria-pressed={is3D}
          title={is3D ? "Cambiar a 2D" : "Cambiar a 3D"}
          className="rounded-[var(--radius-sm)] border border-border bg-surface/90 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-ink-muted backdrop-blur hover:text-ink"
        >
          {is3D ? "3D" : "2D"}
        </button>
        <button
          onClick={toggleFullscreen}
          aria-pressed={fullscreen}
          title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          className="rounded-[var(--radius-sm)] border border-border bg-surface/90 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-ink-muted backdrop-blur hover:text-ink"
        >
          {fullscreen ? "⤡" : "⤢"}
        </button>
      </div>
      <div ref={elRef} style={{ width: "100%", height: fullscreen ? "100vh" : 320 }} />
    </div>
  );
}

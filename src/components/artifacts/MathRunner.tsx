import { useEffect, useRef, useState } from "react";

import KatexMath from "./KatexMath";
import MathSurface from "./MathSurface";
import { probe, solve } from "@/lib/engine/runner";
import type { ResultDoc } from "@/lib/engine/types";
import { decimalOf, toSteps, verificationLabel } from "@/lib/engine/represent/toSteps";

/*
  MathRunner — a `$$…$$` block, run through the engine.

  Deliberately the twin of CodeRunner: a ```js fence gets a play button and prints its output
  underneath, and an equation block does the same. Same box, same place for the answer. The
  differences are what the two things actually are — code is edited in a textarea and runs as a
  whole, whereas a `$$` block is a NOTEBOOK: several lines, each one solvable on its own, the ones
  above usually being the working rather than the query.

  Hence the play button lives on whichever line the cursor is over, and the answer area is single:
  solving another line overwrites it. A stack of answers would just be a worse transcript of the
  block itself.

  This is representation, and it lives here rather than in Rust. The engine emits a ResultDoc and
  knows nothing about buttons — invariant 4 of engine/architecture/02-architecture.md.
*/

/** Let the typing settle before asking the engine which lines it can read. */
const PROBE_DEBOUNCE_MS = 200;

export default function MathRunner({
  lines,
  onRequestEdit,
}: {
  lines: string[];
  /**
   * Click on a line → edit it, caret on that line.
   *
   * `dx` is how far into the formula the click landed, measured from its left edge.
   * KaTeX output carries no source offsets, so a glyph cannot be turned back into a
   * position in the LaTeX; what the editor CAN do is find the symbol at the same
   * distance, and it is the right one because it draws with the same KaTeX fonts at
   * the same size. A screen coordinate would not work: here the formula sits after
   * the run button, in the editor it starts at the edge. Without this, every click
   * on a formula jumped to the end of the line.
   */
  onRequestEdit?: (lineIndex: number, point: { dx: number }) => void;
}) {
  // null = not asked yet. Nothing offers a play button until the engine has answered.
  const [solvable, setSolvable] = useState<boolean[] | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [answer, setAnswer] = useState<{ source: string; document: ResultDoc } | null>(null);
  const [running, setRunning] = useState<number | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [copied, setCopied] = useState(false);
  // Discards answers to a probe the content has already replaced.
  const latest = useRef(0);

  const key = lines.join("\n");
  useEffect(() => {
    const query = ++latest.current;
    const timer = setTimeout(() => {
      probe(lines)
        .then((result) => {
          if (latest.current === query) setSolvable(result);
        })
        // A worker that will not start must not take the block down with it: no
        // play buttons is a worse block, not a broken page.
        .catch(() => {
          if (latest.current === query) setSolvable(null);
        });
    }, PROBE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // `key` is the content; `lines` is a fresh array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const run = async (index: number) => {
    const source = lines[index];
    setRunning(index);
    setShowSteps(false);
    setCopied(false);
    try {
      setAnswer({ source, document: await solve(source) });
    } catch {
      // Only reachable if the worker itself died; engine errors ride inside the document.
      setAnswer(null);
    } finally {
      setRunning(null);
    }
  };

  const copy = () => {
    const latex = answer?.document.result?.latex;
    if (!latex) return;
    void navigator.clipboard.writeText(latex).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <MathSurface>
      {/* Sin cabecera y sin losa interior: eran lo que hacía que un bloque de
          ecuación se leyera como un bloque de código. Lo que dice que esto se
          resuelve es el botón de la línea, que aparece donde está el cursor. */}
      <div className="px-2 py-1" onMouseLeave={() => setHovered(null)}>
        {lines.map((line, index) => (
          <Line
            key={index}
            line={line}
            hovered={hovered === index}
            running={running === index}
            // Until the probe answers, nothing claims to be solvable.
            solvable={solvable?.[index] ?? false}
            onHover={() => setHovered(index)}
            onRun={() => run(index)}
            onEdit={(dx) => onRequestEdit?.(index, { dx })}
          />
        ))}
      </div>

      {answer && (
        <Answer
          document={answer.document}
          copied={copied}
          showSteps={showSteps}
          onCopy={copy}
          onToggleSteps={() => setShowSteps((open) => !open)}
          onClear={() => setAnswer(null)}
        />
      )}
    </MathSurface>
  );
}

function Line({
  line,
  hovered,
  running,
  solvable,
  onHover,
  onRun,
  onEdit,
}: {
  line: string;
  hovered: boolean;
  running: boolean;
  solvable: boolean;
  onHover: () => void;
  onRun: () => void;
  /** Cuánto dentro de la fórmula cayó el clic, desde su borde izquierdo. */
  onEdit: (dx: number) => void;
}) {
  // A blank line inside the block is spacing the author wrote. It keeps its height so the lines
  // below do not jump, but it is not a query.
  if (!line) return <div className="h-5" onMouseEnter={onHover} />;

  return (
    <div
      onMouseEnter={onHover}
      className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 transition-colors hover:bg-surface/40"
    >
      <button
        type="button"
        onClick={onRun}
        disabled={running}
        title={running ? "Resolviendo…" : "Resolver esta línea"}
        aria-label={running ? "Resolviendo" : "Resolver esta línea"}
        /* Reserves its slot always so the line never shifts sideways on hover; only the
           appearance is conditional. A line the engine cannot read shows nothing at all —
           it is not a failure to report, just a line not addressed to the engine. */
        className={`shrink-0 rounded-[var(--radius-sm)] p-1 text-ink-muted transition-opacity hover:text-primary ${
          solvable && hovered ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <PlayIcon spinning={running} />
      </button>

      <div
        onClick={(event) => {
          // Desde el borde de la fórmula pintada, no desde el del contenedor: entre
          // los dos hay el hueco del botón de resolver, y el editor no lo tiene.
          const formula = event.currentTarget.querySelector(".katex")?.getBoundingClientRect();
          onEdit(event.clientX - (formula?.left ?? event.currentTarget.getBoundingClientRect().left));
        }}
        className="min-w-0 flex-1 cursor-text overflow-x-auto"
      >
        <KatexMath math={line} />
      </div>
    </div>
  );
}

function Answer({
  document,
  copied,
  showSteps,
  onCopy,
  onToggleSteps,
  onClear,
}: {
  document: ResultDoc;
  copied: boolean;
  showSteps: boolean;
  onCopy: () => void;
  onToggleSteps: () => void;
  onClear: () => void;
}) {
  const steps = toSteps(document);
  const decimal = decimalOf(document);
  const error = document.error;

  return (
    <div className="border-t border-border">
      <div className="flex items-start gap-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          {/* An engine error IS the answer, not a failure of the app: it gets shown, explained. */}
          {error ? (
            <p className="text-sm text-ink">{error.message}</p>
          ) : (
            <button
              type="button"
              onClick={onCopy}
              title="Copiar el LaTeX del resultado"
              className="max-w-full overflow-x-auto text-left"
            >
              <KatexMath math={document.result?.latex ?? ""} block />
            </button>
          )}

          {decimal && !error && (
            <p className="mt-1 font-mono text-xs text-ink-muted">≈ {decimal}</p>
          )}

          <p className="mt-2 font-mono text-[11px] text-ink-muted">
            {copied ? "LaTeX copiado" : verificationLabel(document)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {steps.length > 0 && (
            <button
              type="button"
              onClick={onToggleSteps}
              title={showSteps ? "Ocultar el paso a paso" : "Ver el paso a paso"}
              aria-expanded={showSteps}
              className={`rounded-[var(--radius-sm)] p-1.5 transition-colors hover:text-primary ${
                showSteps ? "text-primary" : "text-ink-muted"
              }`}
            >
              <StepsIcon />
            </button>
          )}
          <button
            type="button"
            onClick={onClear}
            title="Limpiar el resultado"
            aria-label="Limpiar el resultado"
            className="rounded-[var(--radius-sm)] p-1.5 text-ink-muted transition-colors hover:text-primary"
          >
            <ClearIcon />
          </button>
        </div>
      </div>

      {showSteps && (
        <ol className="space-y-2 border-t border-border px-4 py-3">
          {steps.map((step) => (
            <li key={step.index}>
              <p className="text-xs font-medium text-ink">
                {step.index}. {step.title}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 overflow-x-auto">
                <KatexMath math={step.before} />
                <span className="text-ink-muted">→</span>
                <KatexMath math={step.after} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* Icon-only controls with a `title` tooltip, matching NotesApp's existing buttons. */

function PlayIcon({ spinning }: { spinning: boolean }) {
  if (spinning) {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25" />
        <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 8 8"
            to="360 8 8"
            dur="0.7s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M5 3.5v9a.5.5 0 0 0 .77.42l7-4.5a.5.5 0 0 0 0-.84l-7-4.5A.5.5 0 0 0 5 3.5Z" />
    </svg>
  );
}

function StepsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 12h4V8h4V4h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { runCode, formatRunResult } from "@/lib/codeRunner";
import { runPython } from "@/lib/pyRunner";

export type CodeLang = "js" | "py";

/*
  CodeRunner — runs code sandboxed. JavaScript runs in the opaque-origin iframe + Worker sandbox
  (src/lib/codeRunner.ts — do not weaken; see memory project-mathslice-code-sandbox); Python runs
  via Pyodide in a Worker (src/lib/pyRunner.ts, lazy first-load). In the notes editor this is the
  *rendered* (read-only) view — editing happens as raw markdown; here we display + run. In MDX it's
  fully editable.
*/
export default function CodeRunner({
  code = "",
  label,
  lang: langProp = "js",
  displayLang,
  runnable = true,
  onChange,
  onLangChange,
  onEditorKeyDown,
  autoFocus = false,
  focusCaret = "end",
  readOnly = false,
  onRequestEdit,
  autoRunKey = 0,
}: {
  code?: string;
  label?: string;
  lang?: CodeLang;
  /** Header badge text; defaults to `lang`. Lets a non-runnable fence (rust, sql, plain…) show its real language. */
  displayLang?: string;
  /** Whether this fence can execute (js/py). Non-runnable fences get the same styled box, minus the language switcher/Ejecutar button. */
  runnable?: boolean;
  onChange?: (value: string) => void;
  onLangChange?: (lang: CodeLang) => void;
  onEditorKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  autoFocus?: boolean;
  focusCaret?: number | "start" | "end";
  /** Rendered view (notes): the code is not edited here (edit the raw markdown instead). */
  readOnly?: boolean;
  /** Called with the character offset the user clicked (readOnly textarea already placed its native caret there). */
  onRequestEdit?: (pos: number) => void;
  /** Bump to auto-run (e.g. when compiled with Cmd+Enter from raw edit). */
  autoRunKey?: number;
}) {
  const [source, setSource] = useState(code.trim());
  const [lang, setLang] = useState<CodeLang>(langProp);
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    if (autoFocus && !readOnly && taRef.current) {
      const el = taRef.current;
      el.focus();
      const pos =
        focusCaret === "end"
          ? el.value.length
          : focusCaret === "start"
            ? 0
            : Math.min(focusCaret, el.value.length);
      el.selectionStart = el.selectionEnd = pos;
    }
  }, [autoFocus, focusCaret, readOnly]);

  const run = async () => {
    setRunning(true);
    setOutput(lang === "py" ? "Ejecutando Python…" : null);
    const result = lang === "py" ? await runPython(source) : await runCode(source);
    setOutput(formatRunResult(result));
    setRunning(false);
  };

  // Auto-run when compiled from the raw editor (Cmd+Enter) — only for runnable fences.
  useEffect(() => {
    if (autoRunKey && runnable) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunKey]);

  const pick = (l: CodeLang) => {
    setLang(l);
    onLangChange?.(l);
  };

  return (
    <div
      className={`overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface ${readOnly ? "" : "my-4"}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        {readOnly ? (
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
            {displayLang ?? lang}
          </span>
        ) : (
          <div className="flex overflow-hidden rounded-[var(--radius-sm)] border border-border text-xs font-semibold">
            {(["js", "py"] as CodeLang[]).map((l) => (
              <button
                key={l}
                onClick={() => pick(l)}
                className={`px-2.5 py-1 font-mono uppercase transition-colors ${
                  lang === l ? "bg-primary text-primary-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        )}
        {label && (
          <span className="truncate font-mono text-xs uppercase tracking-[0.16em] text-ink-muted">
            {label}
          </span>
        )}
        {runnable && (
          <button
            onClick={run}
            disabled={running}
            className="ml-auto rounded-[var(--radius-sm)] bg-primary px-3 py-1 text-xs font-semibold text-primary-ink disabled:opacity-60"
          >
            {running ? "Ejecutando…" : "Ejecutar"}
          </button>
        )}
      </div>
      <textarea
        ref={taRef}
        value={source}
        readOnly={readOnly}
        onChange={(e) => {
          if (readOnly) return;
          setSource(e.target.value);
          onChange?.(e.target.value);
        }}
        onClick={readOnly ? (e) => onRequestEdit?.(e.currentTarget.selectionStart) : undefined}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            run(); // Cmd/Ctrl+Enter compiles & runs; plain Enter is a newline
            return;
          }
          onEditorKeyDown?.(e);
        }}
        spellCheck={false}
        rows={Math.min(16, Math.max(2, source.split("\n").length))}
        className={`w-full resize-y bg-bg p-4 font-mono text-sm text-ink outline-none ${
          readOnly ? "cursor-text" : ""
        }`}
        style={{ fontFamily: "var(--f-mono)" }}
      />
      {output !== null && (
        <pre
          className="max-h-64 overflow-auto border-t border-border bg-bg px-4 py-3 font-mono text-sm text-ink-muted"
          style={{ fontFamily: "var(--f-mono)" }}
        >
          {output}
        </pre>
      )}
    </div>
  );
}

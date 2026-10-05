import type { RunResult } from "./codeRunner";

/*
  pyRunner — runs Python via Pyodide (CPython → WASM) inside a Worker, lazily. Pyodide is itself a
  WASM sandbox; running it off the main thread keeps the UI responsive. The first run downloads
  Pyodide (~several MB) from the CDN and is slow; subsequent runs are fast (cached by the browser).
  Mirrors codeRunner's RunResult shape so formatRunResult works for both languages.
*/

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";

let worker: Worker | null = null;
let seq = 0;

function ensureWorker(): Worker {
  if (worker) return worker;
  const src = `
    let ready = null;
    function init() {
      if (!ready) {
        importScripts("${PYODIDE}pyodide.js");
        ready = loadPyodide({ indexURL: "${PYODIDE}" });
      }
      return ready;
    }
    self.onmessage = async (e) => {
      const { id, code } = e.data;
      const out = [];
      try {
        const py = await init();
        py.setStdout({ batched: (s) => out.push(s) });
        py.setStderr({ batched: (s) => out.push(s) });
        const result = await py.runPythonAsync(code);
        self.postMessage({
          id,
          logs: out,
          result: result === undefined || result === null ? undefined : String(result),
        });
      } catch (err) {
        self.postMessage({ id, logs: out, error: String((err && err.message) || err) });
      }
    };
  `;
  worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
  return worker;
}

export async function runPython(code: string): Promise<RunResult> {
  const w = ensureWorker();
  const id = ++seq;
  return new Promise<RunResult>((resolve) => {
    // Generous timeout — the first run includes the Pyodide download.
    const timeout = setTimeout(() => {
      cleanup();
      resolve({ logs: [], error: "Tiempo agotado (¿descarga de Pyodide muy lenta?)" });
    }, 40000);
    const onMessage = (ev: MessageEvent) => {
      if (ev.data?.id !== id) return;
      cleanup();
      resolve({ logs: ev.data.logs || [], result: ev.data.result, error: ev.data.error });
    };
    const cleanup = () => {
      clearTimeout(timeout);
      w.removeEventListener("message", onMessage);
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ id, code });
  });
}

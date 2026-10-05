/**
 * Ejecuta código del usuario fuera del origen de la app.
 *
 * Doble aislamiento:
 *  1. <iframe sandbox="allow-scripts"> sin allow-same-origin -> origen opaco:
 *     sin acceso a localStorage, cookies, ni al DOM del padre.
 *  2. Dentro del iframe, un Worker: sin document, sin window.
 *
 * Un bucle infinito se corta con terminate() al vencer el timeout.
 */

export interface RunResult {
  logs: string[];
  result?: string;
  error?: string;
}

const TIMEOUT_MS = 2000;

// Corre dentro del iframe de origen opaco. Recibe el código por postMessage,
// lo ejecuta en un Worker y devuelve logs/resultado/error al padre.
const IFRAME_HTML = `<!DOCTYPE html><meta charset="utf-8"><script>
const WORKER_SRC = ${JSON.stringify(`
self.onmessage = (e) => {
  const logs = [];
  const toStr = (v) => {
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v) ?? String(v); } catch { return String(v); }
  };
  self.console = {
    log: (...a) => logs.push(a.map(toStr).join(' ')),
    info: (...a) => logs.push(a.map(toStr).join(' ')),
    warn: (...a) => logs.push(a.map(toStr).join(' ')),
    error: (...a) => logs.push(a.map(toStr).join(' ')),
  };
  try {
    const result = new Function('"use strict";' + e.data)();
    self.postMessage({ logs, result: result === undefined ? undefined : toStr(result) });
  } catch (err) {
    self.postMessage({ logs, error: err && err.message ? String(err.message) : String(err) });
  }
};
`)};

window.addEventListener('message', (e) => {
  const reply = (payload) => e.source.postMessage({ id: e.data.id, ...payload }, '*');
  let worker;
  const timer = setTimeout(() => {
    if (worker) worker.terminate();
    reply({ logs: [], error: 'Tiempo de ejecución agotado (${TIMEOUT_MS} ms)' });
  }, ${TIMEOUT_MS});
  try {
    worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })));
    worker.onmessage = (ev) => { clearTimeout(timer); worker.terminate(); reply(ev.data); };
    worker.onerror = (ev) => {
      clearTimeout(timer);
      worker.terminate();
      reply({ logs: [], error: ev.message || 'Error en el worker' });
    };
    worker.postMessage(e.data.code);
  } catch (err) {
    clearTimeout(timer);
    reply({ logs: [], error: String(err) });
  }
});
</scr` + `ipt>`;

let framePromise: Promise<HTMLIFrameElement> | null = null;

function getFrame(): Promise<HTMLIFrameElement> {
  if (framePromise) return framePromise;
  framePromise = new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    // Sin allow-same-origin: el iframe queda en un origen opaco.
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.display = "none";
    iframe.srcdoc = IFRAME_HTML;
    iframe.addEventListener("load", () => resolve(iframe), { once: true });
    document.body.appendChild(iframe);
  });
  return framePromise;
}

let nextId = 0;

export async function runCode(code: string): Promise<RunResult> {
  const iframe = await getFrame();
  const id = ++nextId;

  return new Promise<RunResult>((resolve) => {
    // El iframe es de origen opaco, así que su origin llega como "null".
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const data = event.data as RunResult & { id?: number };
      if (data?.id !== id) return;
      window.removeEventListener("message", onMessage);
      clearTimeout(guard);
      resolve({ logs: data.logs ?? [], result: data.result, error: data.error });
    };

    // Red de seguridad por si el iframe nunca responde.
    const guard = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve({ logs: [], error: "El entorno aislado no respondió" });
    }, TIMEOUT_MS + 1000);

    window.addEventListener("message", onMessage);
    iframe.contentWindow?.postMessage({ id, code }, "*");
  });
}

/** Aplana un RunResult al string que muestra la UI de notas. */
export function formatRunResult({ logs, result, error }: RunResult): string {
  if (error) return error;
  const parts = [...logs];
  if (result !== undefined) parts.push(`=> ${result}`);
  return parts.join("\n") || "(Sin salida)";
}

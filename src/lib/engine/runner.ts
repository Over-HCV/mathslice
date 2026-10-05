/*
  Cliente del worker del motor: worker perezoso, ids de secuencia y timeout.
  Calca el patrón de src/lib/pyRunner.ts, que ya resolvió esto para Pyodide.

  Es un archivo aparte de worker.ts porque un module worker necesita un archivo
  real como punto de entrada; este es el lado de la página, aquel el del hilo.
*/

import type { EngineFunction, ResultDoc } from "./types";
import type { EngineRequest, EngineResponse } from "./worker";

/*
  El presupuesto de reescritura del motor ya acota el trabajo, así que este
  timeout cubre lo que aquel no ve: la descarga del WASM y un worker que no
  arranca. Generoso por la primera carga; las siguientes son inmediatas.
*/
const TIMEOUT_MS = 10000;

let worker: Worker | null = null;
let seq = 0;

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  return worker;
}

/** Manda una petición y espera la respuesta que lleve su mismo id. */
function ask<T>(
  build: (id: number) => EngineRequest,
  read: (response: EngineResponse) => T | undefined,
): Promise<T> {
  const engine = ensureWorker();
  const id = ++seq;

  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("El motor no respondió a tiempo"));
    }, TIMEOUT_MS);

    const onMessage = (event: MessageEvent<EngineResponse>) => {
      if (event.data?.id !== id) return;
      cleanup();

      const value = read(event.data);
      if (value !== undefined) {
        resolve(value);
        return;
      }
      reject(new Error(event.data.error ?? "El motor falló sin explicación"));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      engine.removeEventListener("message", onMessage);
    };

    engine.addEventListener("message", onMessage);
    engine.postMessage(build(id));
  });
}

/**
 * Resuelve una expresión LaTeX.
 *
 * Los errores del motor —sintaxis, división entre cero, presupuesto agotado—
 * llegan **dentro** del `ResultDoc`, en su campo `error`. Esta promesa sólo se
 * rechaza si el worker en sí no responde.
 */
export function solve(latex: string): Promise<ResultDoc> {
  return ask(
    (id) => ({ id, kind: "solve", latex }),
    (response) => (response.kind === "solve" ? response.document : undefined),
  );
}

/**
 * ¿Sabe el motor leer cada una de estas líneas? Sólo parsea: no resuelve.
 *
 * Es lo que decide si una línea ofrece el botón de resolver. Que diga que sí no
 * promete que resolver salga bien —`\frac{2}{0}` parsea y luego falla, y ese
 * error merece mostrarse—; que diga que no es una línea que todavía no va
 * dirigida al motor, y ahí callar es lo correcto.
 */
export function probe(lines: string[]): Promise<boolean[]> {
  if (lines.length === 0) return Promise.resolve([]);
  return ask(
    (id) => ({ id, kind: "probe", lines }),
    (response) => (response.kind === "probe" ? response.solvable : undefined),
  );
}

/*
  La respuesta no cambia mientras la página vive —el motor es el mismo .wasm— así
  que se pide una vez. Sin esto, cada bloque de matemáticas que se abre paga otro
  viaje al worker para recibir exactamente la misma lista.
*/
let cachedFunctions: Promise<EngineFunction[]> | null = null;

/**
 * Qué funciones sabe leer el motor, con su aridad.
 *
 * Es lo que puede ofrecer la paleta y el autocompletado del editor. Se pregunta
 * en vez de escribirse porque una lista escrita a mano ofrecería `raiz` o `\sin`
 * —que este motor rechaza— y se quedaría corta cada vez que una etapa añade una
 * función, sin que nada avise.
 */
export function functions(): Promise<EngineFunction[]> {
  if (!cachedFunctions) {
    cachedFunctions = ask<EngineFunction[]>(
      (id) => ({ id, kind: "surface" }),
      (response) => (response.kind === "surface" ? response.functions : undefined),
      // Un fallo aquí no se guarda: la próxima apertura del bloque vuelve a
      // preguntar. Cachear el rechazo dejaría la paleta vacía para siempre por
      // un arranque lento del worker.
    ).catch((error: unknown) => {
      cachedFunctions = null;
      throw error;
    });
  }
  return cachedFunctions;
}

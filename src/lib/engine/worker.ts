/*
  El worker del motor. Corre en su propio hilo: una expresión patológica puede
  agotar el presupuesto de reescritura sin congelar la interfaz.

  A diferencia de pyRunner.ts, aquí el worker es un archivo real y no una cadena
  en un Blob. Pyodide se descarga de un CDN y por eso allí basta con
  importScripts; el WASM del motor es nuestro, y dejar que Vite lo empaquete es
  lo que le pone hash al artefacto y evita la clase entera de bugs de caché rancia.
*/

import init, { probe, solve, surface } from './pkg/ms_engine.js'
import type { EngineFunction, ResultDoc } from './types.js'

/**
 * `probe` viaja con TODAS las líneas de un bloque a la vez. Una consulta por
 * línea multiplicaría los mensajes por algo que se responde en microsegundos, y
 * el coste real aquí es cruzar al worker, no parsear.
 */
export type EngineRequest =
	| { id: number; kind: 'solve'; latex: string }
	| { id: number; kind: 'probe'; lines: string[] }
	| { id: number; kind: 'surface' }

export type EngineResponse =
	| { id: number; kind: 'solve'; document?: ResultDoc; error?: string }
	| { id: number; kind: 'probe'; solvable?: boolean[]; error?: string }
	| { id: number; kind: 'surface'; functions?: EngineFunction[]; error?: string }

// El WASM se instancia una vez y perezosamente: la primera consulta lo paga, las
// siguientes no.
let ready: Promise<unknown> | null = null

function ensureEngine(): Promise<unknown> {
	if (!ready) ready = init()
	return ready
}

self.onmessage = async (event: MessageEvent<EngineRequest>) => {
	const request = event.data

	try {
		await ensureEngine()

		if (request.kind === 'probe') {
			self.postMessage({
				id: request.id,
				kind: 'probe',
				solvable: request.lines.map(probe),
			} satisfies EngineResponse)
			return
		}

		if (request.kind === 'surface') {
			self.postMessage({
				id: request.id,
				kind: 'surface',
				functions: JSON.parse(surface()) as EngineFunction[],
			} satisfies EngineResponse)
			return
		}

		// El motor no tiene reloj, así que el tiempo se mide aquí. Incluye el coste
		// de cruzar la frontera WASM, que es justamente lo que espera el usuario.
		const startedAt = performance.now()
		const encoded = solve(request.latex)
		const elapsed = performance.now() - startedAt

		const document = JSON.parse(encoded) as ResultDoc
		document.timing_ms = elapsed

		self.postMessage({ id: request.id, kind: 'solve', document } satisfies EngineResponse)
	} catch (error) {
		// Llegar aquí significa que falló la carga del WASM o el propio worker: los
		// errores matemáticos y de sintaxis vienen dentro del documento.
		self.postMessage({
			id: request.id,
			kind: request.kind,
			error: error instanceof Error ? error.message : String(error),
		} satisfies EngineResponse)
	}
}

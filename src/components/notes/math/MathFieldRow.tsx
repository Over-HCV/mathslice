import type { MathfieldElement } from "mathlive";
import { useEffect, useRef } from "react";

import { foldFunctions, toDocument } from "./mathlive-latex";
import { mountMathfield } from "./mathlive-setup";
import { focusWithoutScroll } from "@/lib/focus";

/*
  Una línea del bloque, editada con MathLive.

  El campo se crea a mano y se mete en un div: MathLive es un custom element y su
  clase no está registrada hasta que el módulo termina de cargar, así que escribir
  el tag en JSX sería pedirle a React que renderice algo que todavía no existe.

  Este archivo no decide nada sobre el bloque —ni Enter, ni Escape, ni `\`—: sólo
  monta el campo, mantiene su valor y reenvía los eventos. Quién es dueño de cada
  tecla se decide en MathBlockEditor, que es quien ve todas las líneas.
*/

/**
 * Dónde cayó el clic que abrió la edición.
 *
 * Es la distancia desde el **inicio de la fórmula**, no una coordenada de pantalla:
 * en lectura la fórmula lleva delante el botón de resolver y arranca unos 30 px más
 * a la derecha que en edición, así que la misma `clientX` señalaría otro símbolo. La
 * distancia sí vale para las dos, porque KaTeX y MathLive dibujan con las mismas
 * fuentes al mismo tamaño.
 */
export interface FocusPoint {
  dx: number;
}

/** Cuántos intentos se hacen a que MathLive tenga maquetados sus símbolos, y cada cuánto. */
const LAYOUT_ATTEMPTS = 6;
const LAYOUT_RETRY_MS = 16;

/**
 * Pone el cursor donde el usuario hizo clic, o al final si no hubo clic.
 *
 * Se reintenta unos cuantos frames porque las cajas de los símbolos no existen
 * hasta que MathLive maqueta el valor que se le acaba de dar, y sin cajas el cursor
 * se iba siempre al final — que es justo el defecto que esto viene a arreglar.
 */
function placeCaret(field: MathfieldElement, point: FocusPoint | null, attempt = 0) {
  if (!point) {
    field.executeCommand("moveToMathfieldEnd");
    return;
  }

  const start = field.getElementInfo(0)?.bounds?.left;
  if (start === undefined) {
    if (attempt < LAYOUT_ATTEMPTS) {
      // Con un temporizador y no con `requestAnimationFrame`: un rAF no dispara
      // mientras la pestaña no se ve, y entonces el cursor no se colocaba nunca.
      setTimeout(() => placeCaret(field, point, attempt + 1), LAYOUT_RETRY_MS);
      return;
    }
    // Sin cajas no hay forma de saber qué símbolo se señaló. El final es donde
    // estaba antes de todo esto, y es una respuesta.
    field.executeCommand("moveToMathfieldEnd");
    return;
  }

  field.position = offsetAt(field, start + point.dx);
}

/**
 * La posición del cursor más cercana a la `x` de la pantalla.
 *
 * Se calcula con `getElementInfo`, que da la caja de cada posición: se busca la más
 * próxima y se entra por su lado izquierdo o derecho según de qué mitad venga el
 * clic. Todo API pública.
 *
 * La vía obvia —mandarle a MathLive un `pointerdown` sintético en esas
 * coordenadas— **no** sirve: su manejador llama a `setPointerCapture` con el
 * `pointerId` del evento, y un evento fabricado no tiene puntero activo que
 * capturar, así que lanza `NotFoundError` por dentro y el cursor no se mueve.
 * Neutralizar esa captura significaría parchear un método del DOM en un elemento
 * que es suyo y elegido por él, no el nuestro.
 */
function offsetAt(field: MathfieldElement, x: number): number {
  let best = field.lastOffset;
  let bestDistance = Infinity;

  for (let offset = 0; offset <= field.lastOffset; offset += 1) {
    const bounds = field.getElementInfo(offset)?.bounds;
    if (!bounds) continue;

    const middle = bounds.left + bounds.width / 2;
    const distance = Math.abs(middle - x);
    if (distance >= bestDistance) continue;

    bestDistance = distance;
    // Antes del símbolo si el clic cayó en su mitad izquierda, después si en la
    // derecha: es donde el usuario esperaría ver la barra del cursor.
    best = x < middle ? Math.max(0, offset - 1) : offset;
  }

  return best;
}

export interface MathFieldHandlers {
  onChange: (latex: string) => void;
  /** El campo, cuando existe, y `null` al desmontarse: para poder enfocarlo desde fuera. */
  onReady: (field: MathfieldElement | null) => void;
  onFocus: (field: MathfieldElement) => void;
  /** Una flecha que ya no tiene sitio adonde ir dentro del campo. */
  onMoveOut: (direction: "forward" | "backward" | "upward" | "downward") => void;
  /** En captura, ANTES de que MathLive lo vea. Devuelve `true` si se lo queda. */
  onKeyDown: (event: KeyboardEvent, field: MathfieldElement) => boolean;
}

export default function MathFieldRow({
  latex,
  autoFocus,
  focusPoint,
  functionNames,
  handlers,
}: {
  latex: string;
  autoFocus: boolean;
  /** Dónde cayó el clic que abrió el bloque, si lo abrió un clic. */
  focusPoint: FocusPoint | null;
  /**
   * Las funciones del motor, para volver a plegarlas a átomos al cargar.
   *
   * Fijas durante la vida de la fila: MathBlockEditor no monta ninguna hasta que
   * la superficie del motor ha contestado. Si pudieran llegar a mitad, el valor
   * del campo habría que replegarlo con el cursor dentro.
   */
  functionNames: string[];
  handlers: MathFieldHandlers;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<MathfieldElement | null>(null);

  // Los oyentes se registran una vez y viven tanto como el campo, así que leen
  // los callbacks de aquí en lugar de capturar los de su render.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // El montaje es asíncrono —MathLive se carga con `import()`— así que lee de aquí
  // en vez de del render que lo empezó.
  const functionNamesRef = useRef(functionNames);
  functionNamesRef.current = functionNames;

  // Lo último que este campo mandó hacia arriba. Sirve para distinguir un cambio
  // que viene del usuario —ya está en el campo, no hay que reescribirlo— de uno
  // que viene de fuera, que sí.
  const emittedRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    void mountMathfield(host).then((field) => {
      // La carga es asíncrona: el bloque puede haberse cerrado mientras tanto.
      if (cancelled) {
        field.remove();
        return;
      }

      fieldRef.current = field;
      field.value = foldFunctions(latex, functionNamesRef.current);
      emittedRef.current = latex;

      field.addEventListener("input", () => {
        const written = toDocument(field.getValue("latex-expanded"));
        emittedRef.current = written;
        handlersRef.current.onChange(written);
      });
      field.addEventListener("focusin", () => handlersRef.current.onFocus(field));
      field.addEventListener("move-out", (event) => {
        // Cancelable: sin esto MathLive mueve el foco al siguiente tabulable de la
        // página, y la navegación entre bloques es de NotesApp, no suya.
        event.preventDefault();
        handlersRef.current.onMoveOut(event.detail.direction);
      });

      // En captura y sobre el propio elemento: el objetivo real del evento es un
      // textarea dentro de su shadow DOM, así que aquí llega ANTES que a MathLive
      // y `\` se puede interceptar sin que él lo vea.
      field.addEventListener(
        "keydown",
        (event) => {
          if (!handlersRef.current.onKeyDown(event, field)) return;
          event.preventDefault();
          event.stopPropagation();
        },
        true,
      );

      handlersRef.current.onReady(field);

      if (autoFocus) {
        /*
          Enfocar puede lanzar, y no por nuestra culpa: MathLive, al recibir el
          foco, hace el `onBlur` del campo que lo tenía antes, y si aquél ya se
          desmontó su modelo interno no existe («Cannot read properties of
          undefined (reading 'options')»). Lo que no puede pasar es que ese fallo
          suyo se lleve por delante lo que viene después —el cursor se quedaba al
          final de la línea siempre— así que se aísla aquí.
        */
        try {
          focusWithoutScroll(field);
        } catch (error) {
          console.warn("MathSlice: MathLive falló al enfocar el campo", error);
        }

        // Colocar el cursor necesita las cajas de los símbolos (`getElementInfo`), y
        // MathLive todavía no ha maquetado el valor que se le acaba de dar: se
        // reintenta unos milisegundos.
        placeCaret(field, focusPoint);
      }
    // Un fallo aquí deja la fila vacía, y una fila vacía sin explicación fue
    // exactamente el bug de la primera versión: el bloque salía con su paleta y
    // ni un sitio donde escribir. Se dice en consola, y el conmutador «editar el
    // LaTeX a mano» sigue siendo el camino de salida.
    }).catch((error: unknown) => {
      console.error("MathSlice: no se pudo montar el campo de matemáticas", error);
    });

    return () => {
      cancelled = true;
      // Se quita el foco ANTES de sacarlo del DOM: MathLive guarda cuál es el campo
      // enfocado en su módulo, y si se va sin avisar el siguiente que se enfoque
      // intenta hacerle el `onBlur` a un campo que ya no tiene modelo, y lanza.
      fieldRef.current?.blur();
      fieldRef.current?.remove();
      fieldRef.current = null;
      handlersRef.current.onReady(null);
    };
    // Sólo al montar: el valor y el foco se mantienen en los efectos de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Un cambio que no salió de este campo —deshacer, o reabrir el bloque— se
  // escribe encima. Uno que sí salió de él ya está escrito, y reescribirlo movería
  // el cursor al final en medio de la frase.
  useEffect(() => {
    const field = fieldRef.current;
    if (!field || latex === emittedRef.current) return;

    emittedRef.current = latex;
    field.value = foldFunctions(latex, functionNamesRef.current);
  }, [latex]);

  return <div ref={hostRef} className="min-w-0 flex-1 overflow-x-auto" />;
}

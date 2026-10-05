/*
  Arranque de MathLive: una sola puerta para crear un campo ya configurado.

  MathLive se carga con `import()` y no arriba del archivo. Es ~1 MB, y quien abre
  la lista de anotaciones no tiene por qué pagarlo hasta que edita matemáticas.
  Además el módulo define un custom element y toca `window` al cargarse: la isla es
  `client:only` y no llega a correr en el servidor, pero mantenerlo perezoso quita
  esa preocupación de encima en vez de confiar en ella.

  Todo lo que se apaga aquí se apaga por el mismo motivo: **el motor sólo lee una
  lista corta de LaTeX** (`src/lib/engine/surface.ts`), y cualquier ayuda de
  MathLive que escriba fuera de ella produce `unknown-command` en una línea que el
  estudiante escribió confiando en la herramienta.
*/

import type { MathfieldElement } from "mathlive";

import { functions } from "@/lib/engine/runner";

/** MathLive dibuja con las fuentes de KaTeX, que ya vienen con este CSS. */
import "katex/dist/katex.min.css";

/**
 * Se carga una vez. La promesa se guarda —no el módulo— para que dos campos que
 * se montan a la vez compartan la misma carga en lugar de pedirla dos veces.
 */
let loading: Promise<typeof MathfieldElement> | null = null;

async function loadMathlive(): Promise<typeof MathfieldElement> {
  const mathlive = await import("mathlive");
  const element = mathlive.MathfieldElement;

  /* Las fuentes ya están: `katex.min.css` declara las mismas familias
     (`KaTeX_Main`, `KaTeX_Math`…) y Vite le pone hash a los .woff2. Sin este
     `null`, MathLive inyecta su propia hoja apuntando a un directorio que en
     nuestro build no existe — una petición de red rota, y encima externa
     (`global.css`: «no external requests»). */
  element.fontsDirectory = null;

  /* Sin esto, cada tecla intenta descargar un .wav. Un editor de matemáticas que
     hace ruido no lo ha pedido nadie. */
  element.soundsDirectory = null;

  /* El CAS de CortexJS no está en el bundle: MathLive lo busca en un global que
     nadie define, así que sólo entraría si alguien lo importara a propósito.
     Ponerlo en `null` deja escrito que este editor no lo quiere —el motor de
     MathSlice es el que calcula— y de paso evita que se enganche si algún día
     otra dependencia lo arrastra. */
  element.computeEngine = null;

  return element;
}

/**
 * Un campo listo para escribir matemáticas que el motor sabe leer, ya metido en
 * `host`.
 *
 * Se construye a mano (`new MathfieldElement()`) en vez de escribir `<math-field>`
 * en JSX: así el elemento no existe hasta que su clase está registrada, que es el
 * orden correcto, y no hace falta declarar el tag para React.
 *
 * **Se monta, se espera su evento `mount`, y sólo entonces se configura.** Ese
 * orden ha costado dos intentos y conviene no volver a tocarlo:
 *
 * - Configurar antes de meterlo en el DOM lanza `Mathfence not mounted`: los
 *   valores viven en el mathfield interno, que aún no existe.
 * - Configurar justo después de `appendChild` lanza lo mismo, porque MathLive no
 *   crea ese interno de forma síncrona.
 * - Pasarlo en el constructor lo rechaza él: «cannot be used as a constructor
 *   option. Use mf.inlineShortcuts = ...».
 *
 * Las tres veces el síntoma fue el mismo —un bloque con su paleta, su pista y ni
 * una línea donde escribir— porque la promesa se rompía antes de añadir el campo.
 * `mount` es la señal que MathLive publica justo para esto.
 */
export async function mountMathfield(host: HTMLElement): Promise<MathfieldElement> {
  if (!loading) loading = loadMathlive();
  const [Mathfield, functionMacros] = await Promise.all([loading, macros()]);

  const field = new Mathfield();
  field.className = "block w-full";

  host.appendChild(field);
  await whenMounted(field);

  /* Los paréntesis se convierten en `\left(…\right)`, que es exactamente lo que
     el escritor del motor emite: lo que el estudiante teclea y lo que le
     devuelven se ven iguales. */
  field.smartFence = true;

  /* `smartMode` detecta prosa y la envuelve en `\text{…}`, que el parser rechaza.
     Es la ayuda que más caro sale: escribes `de` en medio y la línea entera deja
     de resolverse sin que nada lo explique. */
  field.smartMode = false;

  /* Los atajos de fábrica escriben `\pi`, `\sqrt`, `\ne`… nada de eso parsea.
     El popover propio de `\` es lo que los sustituye. */
  field.inlineShortcuts = {};

  /* Su popover sugiere sobre TODA la lista de comandos de MathLive. El nuestro
     sugiere sobre la del motor, que es la que se puede resolver. */
  field.popoverPolicy = "off";

  /* Su teclado en pantalla ofrece √, π, ∫ y matrices, y además roba el foco
     —lo que cerraría la edición del bloque. Nunca se muestra. */
  field.mathVirtualKeyboardPolicy = "manual";

  /* Su menú contextual exporta a MathML, inserta matrices y cambia de color:
     o no parsea o no es de este editor. */
  field.menuItems = [];

  field.macros = { ...field.macros, ...functionMacros };

  return field;
}

/** Cuánto se espera el `mount` antes de intentarlo igual y dejar que se queje. */
const MOUNT_TIMEOUT_MS = 3000;

/**
 * Espera a que el campo tenga su mathfield interno.
 *
 * Se comprueba antes de escuchar porque el evento puede haber pasado ya —lo lanza
 * en un microtask— y quedarse esperando uno que no va a volver dejaría la fila
 * vacía para siempre. Leer `menuItems` es la comprobación: es justo el getter que
 * lanza cuando no está montado.
 */
async function whenMounted(field: MathfieldElement): Promise<void> {
  try {
    void field.menuItems;
    return;
  } catch {
    /* Todavía no; se espera el evento. */
  }

  await Promise.race([
    new Promise<void>((mounted) => {
      field.addEventListener("mount", () => mounted(), { once: true });
    }),
    // Si no llega, se sigue: los setters de abajo lanzarán y MathFieldRow lo
    // dirá en consola. Un editor colgado sin explicación es peor.
    new Promise<void>((giveUp) => setTimeout(giveUp, MOUNT_TIMEOUT_MS)),
  ]);
}

/**
 * Las funciones del motor, como macros: `\expandir` se **ve** `expandir` y por
 * detrás es `\operatorname{expandir}`.
 *
 * `captureSelection` es lo que la convierte en un átomo: el cursor no entra en las
 * letras del nombre, y un borrado se lleva la función entera en vez de dejar
 * `\operatorname{expandi}`, que no es nada.
 *
 * Lo que se guarda en el documento es la forma larga —`getValue("latex-expanded")`
 * en mathlive-latex.ts— porque `\expandir` sólo existe dentro de este editor.
 */
async function macros(): Promise<Record<string, { def: string; captureSelection: boolean }>> {
  let names: string[] = [];
  try {
    names = (await functions()).map((entry) => entry.name);
  } catch {
    // Sin motor no hay átomos, pero el campo escribe LaTeX igual. Media
    // herramienta es mejor que un bloque que no se abre.
    return {};
  }

  return Object.fromEntries(
    names.map((name) => [name, { def: `\\operatorname{${name}}`, captureSelection: true }]),
  );
}

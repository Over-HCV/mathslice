import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

import KatexMath from "@/components/artifacts/KatexMath";
import type { Insertable } from "@/lib/engine/surface";

/*
  El popover de `\`: se teclea `\expan`, y lo que sale es lo que el motor sabe
  resolver.

  Gemelo del menú `/` de bloques de NotesApp, a propósito — mismo gesto, mismo
  orden difuso (`lib/fuzzy.ts`), mismas teclas. La diferencia es el sitio: `/`
  inserta un bloque, `\` inserta matemáticas.

  **Va en un portal.** El bloque de ecuación es `.glass`, y `.glass` lleva
  `isolation: isolate` (global.css): dentro de él ningún `z-index` puede subir por
  encima del resto de la página, así que un menú absoluto quedaría recortado por
  su propio contenedor. Se posiciona con el rect del cursor, que es dato del
  llamador porque es quien sabe dónde está el campo.
*/

/** Ni menos —no se vería para qué sirve— ni más, que taparía el propio bloque. */
const MAX_VISIBLE = 8;

export interface PopoverAnchor {
  left: number;
  top: number;
}

export default function MathCommandPopover({
  query,
  items,
  index,
  anchor,
  onPick,
}: {
  /** Lo teclado tras `\`, sin la barra. */
  query: string;
  items: Insertable[];
  index: number;
  anchor: PopoverAnchor;
  onPick: (item: Insertable) => void;
}) {
  // El portal necesita el `document`, que en el primer render del servidor no
  // existe. La isla es client:only, pero esto lo hace cierto por construcción.
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => setMounted(true), []);

  // Con la lista vacía sigue apareciendo: lo teclado se ve, y eso ya dice que no
  // hay comando con ese nombre. Un popover que desaparece dejaría al usuario
  // escribiendo sin ninguna señal de dónde va lo que teclea.
  if (!mounted) return null;

  const visible = items.slice(0, MAX_VISIBLE);

  return createPortal(
    <div
      // No es un diálogo: el foco sigue en el campo, que es donde se escribe. El
      // campo se anuncia con aria-activedescendant desde el editor.
      role="listbox"
      aria-label={`Comandos que empiezan por ${query}`}
      style={{ left: anchor.left, top: anchor.top }}
      className="glass fixed z-50 max-h-72 w-56 overflow-y-auto rounded-[var(--radius-sm)] p-1"
    >
      {/* Lo teclado no aparece en el campo —la tecla no llega a MathLive— así que
          se muestra aquí, o el usuario escribiría a ciegas. */}
      <p className="px-2 py-1 font-mono text-xs text-ink-muted">{`\\${query}`}</p>

      {visible.map((item, position) => (
        <button
          key={item.id}
          type="button"
          role="option"
          id={`math-command-${item.id}`}
          aria-selected={position === index}
          // El ratón no se lleva el foco: el campo tiene que conservar el cursor
          // y la selección para que la inserción caiga donde el usuario está.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(item)}
          className={`flex w-full items-center justify-between gap-3 rounded-[var(--radius-sm)] px-2 py-1.5 text-left ${
            position === index ? "bg-primary text-primary-ink" : "text-ink"
          }`}
        >
          <span className="font-mono text-xs">{item.command}</span>
          <span className="shrink-0 text-sm">
            <KatexMath math={item.preview} />
          </span>
        </button>
      ))}
    </div>,
    document.body,
  );
}

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import KatexMath from "@/components/artifacts/KatexMath";
import type { Insertable, InsertableGroup, InsertableGroupId } from "@/lib/engine/surface";

/*
  La paleta: una sola línea de iconos, y lo que hay dentro de cada uno en un
  submenú.

  Una línea porque el bloque de ecuación se lee a lo ancho: si la paleta crece
  hacia abajo, empuja las matemáticas y ocupa más que el propio contenido. Si no
  caben los iconos, la barra rueda en horizontal; nunca envuelve.

  Cada categoría se representa con su símbolo, pintado con KaTeX. Un icono que ES
  matemáticas no necesita que le pongan nombre en dos idiomas, y dice mejor lo que
  hay dentro que la palabra «Estructura».

  Lo que el motor todavía no lee sale **apagado** con su explicación. Esconderlo
  dejaría al estudiante buscando la raíz cuadrada por los menús sin saber si está
  en otro sitio o no existe.

  El submenú va en un portal: `.glass` lleva `isolation: isolate` (global.css), y
  dentro de él ningún z-index sube por encima del resto de la página.
*/

/** Cuánto se aparta el submenú del botón, en píxeles. */
const MENU_GAP = 6;

export default function MathPalette({
  groups,
  labels,
  unsupportedHint,
  onInsert,
}: {
  groups: InsertableGroup[];
  /** El nombre de cada categoría, en el idioma de la página. */
  labels: Record<InsertableGroupId, string>;
  /** Qué decir de un botón que el motor aún no puede leer. */
  unsupportedHint: string;
  onInsert: (item: Insertable) => void;
}) {
  const [open, setOpen] = useState<InsertableGroupId | null>(null);
  const [anchor, setAnchor] = useState({ left: 0, top: 0 });
  const barRef = useRef<HTMLDivElement | null>(null);

  // Un clic fuera cierra. El submenú vive en un portal, así que «fuera» son dos
  // sitios: ni la barra ni el propio menú. Y Escape también, porque el foco sigue
  // en el campo de matemáticas y desde el teclado no hay «fuera» donde pulsar.
  useEffect(() => {
    if (!open) return;

    const onDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (barRef.current?.contains(target)) return;
      if (target.closest("[data-math-palette-menu]")) return;
      setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Se queda el Escape: cerrar el menú es lo que el usuario pidió, y sin esto
      // el bloque entero saldría de edición de paso.
      event.preventDefault();
      event.stopPropagation();
      setOpen(null);
    };

    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const filled = groups.filter((group) => group.items.length > 0);
  if (filled.length === 0) return null;

  const toggle = (group: InsertableGroup, button: HTMLButtonElement) => {
    if (open === group.id) return setOpen(null);
    const rect = button.getBoundingClientRect();
    setAnchor({ left: rect.left, top: rect.bottom + MENU_GAP });
    setOpen(group.id);
  };

  const openGroup = filled.find((group) => group.id === open);

  return (
    <div
      ref={barRef}
      // `flex-nowrap` + scroll: la barra es de una línea, pase lo que pase.
      className="hide-scrollbar flex flex-nowrap items-center gap-1 overflow-x-auto px-2 py-1"
    >
      {filled.map((group) => (
        <button
          key={group.id}
          type="button"
          title={labels[group.id]}
          aria-label={labels[group.id]}
          aria-expanded={open === group.id}
          // El ratón no se lleva el foco: el campo conserva cursor y selección,
          // que es donde va a caer la inserción.
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => toggle(group, event.currentTarget)}
          className={`shrink-0 rounded-[var(--radius-sm)] px-2 py-0.5 text-sm transition-colors ${
            open === group.id ? "bg-primary/20 text-primary" : "text-ink-muted hover:text-ink"
          }`}
        >
          <KatexMath math={group.icon} />
        </button>
      ))}

      {openGroup &&
        createPortal(
          <div
            data-math-palette-menu
            style={{ left: anchor.left, top: anchor.top }}
            className="glass fixed z-50 max-h-64 w-64 overflow-y-auto rounded-[var(--radius-sm)] p-1"
          >
            <p className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              {labels[openGroup.id]}
            </p>
            <div className="flex flex-wrap gap-1">
              {openGroup.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.supported}
                  title={item.supported ? item.command : `${item.command} — ${unsupportedHint}`}
                  aria-label={item.supported ? item.command : `${item.command}, ${unsupportedHint}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setOpen(null);
                    onInsert(item);
                  }}
                  className={`rounded-[var(--radius-sm)] px-2 py-1 text-sm transition-colors ${
                    item.supported
                      ? "text-ink hover:bg-surface/60"
                      : "cursor-not-allowed text-ink-muted/40"
                  }`}
                >
                  <KatexMath math={item.preview} />
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

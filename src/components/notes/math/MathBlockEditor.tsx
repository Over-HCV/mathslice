import type { MathfieldElement } from "mathlive";
import { useEffect, useMemo, useRef, useState } from "react";

import MathCommandPopover, { type PopoverAnchor } from "./MathCommandPopover";
import MathFieldRow, { type FocusPoint, type MathFieldHandlers } from "./MathFieldRow";
import MathPalette from "./MathPalette";
import { foldFunctions } from "./mathlive-latex";
import { focusWithoutScroll } from "@/lib/focus";
import {
  insertableGroups,
  matchInsertables,
  type Insertable,
  type InsertableGroup,
} from "@/lib/engine/surface";

/*
  El editor de un bloque `$$…$$`: una fila de MathLive por línea, la paleta arriba
  y el popover de `\`.

  Es dueño de las teclas del bloque —Enter, Escape, Cmd+Enter, Alt+flechas— porque
  es el único que ve todas las líneas. Las filas sólo saben de la suya.

  **`\` se intercepta antes de que MathLive lo vea.** MathLive tiene su propio modo
  de comandos con su propia lista, y esa lista incluye `\sqrt`, `\pi` y todo lo que
  el motor rechaza. Quedándonos la tecla, lo que se teclea va a un buffer nuestro y
  la lista es la del motor. Si no casa nada, la barra y lo teclado se insertan tal
  cual: el popover es un atajo, no una cárcel.

  `/` NO se intercepta: en MathLive es el atajo de fracción, y quitárselo rompería
  `x/y`. Por eso el disparador es `\` y no `/` como en el menú de bloques.
*/

/** Lo que ya no cabe en la línea de arriba: la dirección con la que se sale del bloque. */
export type CrossDirection = "up" | "down" | "left" | "right";

interface Popover {
  /** Lo teclado tras `\`, sin la barra. */
  query: string;
  index: number;
  anchor: PopoverAnchor;
}

/**
 * Las filas con las que se abre el editor, y en cuál va el cursor.
 *
 * Las líneas vacías del documento no se convierten en filas: son la separación con
 * la que estaba escrito, no algo que editar. Y un bloque recién creado —que es
 * `$$\n\n$$`, todo vacío— abre con una fila, no con tres.
 */
function seedRows(lines: string[], focusLine: number): { rows: string[]; focus: number } {
  const rows: string[] = [];
  let focus = 0;

  lines.forEach((line, index) => {
    const written = line.trim();
    if (!written) return;
    if (index <= focusLine) focus = rows.length;
    rows.push(written);
  });

  return rows.length > 0 ? { rows, focus } : { rows: [""], focus: 0 };
}

export default function MathBlockEditor({
  initialLines,
  focusLine,
  focusPoint,
  labels,
  unsupportedHint,
  onChange,
  onCompile,
  onEscape,
  onCross,
  onMoveBlock,
}: {
  /**
   * Sólo el punto de partida. Mientras el bloque está abierto las filas son de
   * este componente: una fila vacía existe para escribir en ella, y el documento
   * —que no guarda líneas vacías— no puede ser quien la sostenga.
   */
  initialLines: string[];
  /** La línea donde va el cursor al abrir el bloque. */
  focusLine: number;
  /** Dónde cayó el clic que lo abrió, para que el cursor caiga en ese símbolo. */
  focusPoint: FocusPoint | null;
  labels: Record<InsertableGroup["id"], string>;
  /** Qué decir de lo que se muestra apagado porque el motor aún no lo lee. */
  unsupportedHint: string;
  onChange: (lines: string[]) => void;
  onCompile: () => void;
  onEscape: () => void;
  onCross: (direction: CrossDirection) => void;
  onMoveBlock: (delta: -1 | 1) => void;
}) {
  // La semilla se calcula una vez: `initialLines` cambia en cuanto se escribe
  // —lo que se escribe vuelve por `onChange`— y recalcularla movería el cursor.
  const seed = useRef(seedRows(initialLines, focusLine));

  const [rows, setRows] = useState<string[]>(seed.current.rows);
  const [groups, setGroups] = useState<InsertableGroup[] | null>(null);
  const [popover, setPopover] = useState<Popover | null>(null);
  /** Qué fila enfocar y por qué extremo entrar. Al bajar se entra por el principio. */
  const [pendingFocus, setPendingFocus] = useState<{ index: number; place: "start" | "end" } | null>(
    null,
  );

  const fieldsRef = useRef<(MathfieldElement | null)[]>([]);
  const activeRef = useRef<MathfieldElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void insertableGroups().then((loaded) => {
      if (!cancelled) setGroups(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const functionNames = useMemo(
    () => groups?.find((group) => group.id === "functions")?.items.map((item) => item.command) ?? [],
    [groups],
  );

  // Las filas se enfocan a mano cuando se añade o se quita una: no se vuelven a
  // montar, así que `autoFocus` —que es cosa del montaje— no las alcanza.
  useEffect(() => {
    if (!pendingFocus) return;
    const field = fieldsRef.current[pendingFocus.index];
    const place = pendingFocus.place;
    setPendingFocus(null);
    if (!field) return;
    focusWithoutScroll(field);
    field.executeCommand(place === "end" ? "moveToMathfieldEnd" : "moveToMathfieldStart");
  }, [pendingFocus, rows]);

  /** Toda mutación pasa por aquí: las filas son el estado y el documento el reflejo. */
  const commit = (next: string[]) => {
    setRows(next);
    onChange(next);
  };

  const write = (index: number, latex: string) => {
    const next = [...rows];
    next[index] = latex;
    commit(next);
  };

  const addLineBelow = (index: number) => {
    const next = [...rows];
    next.splice(index + 1, 0, "");
    commit(next);
    setPendingFocus({ index: index + 1, place: "start" });
  };

  /** Borrar hacia atrás en una línea vacía la quita, como en un bloque de texto. */
  const removeLine = (index: number) => {
    // `fieldsRef` no se toca: las filas van por índice, así que la que quede en la
    // posición `index` es la misma instancia con otro texto, y la última es la que
    // se desmonta y limpia su hueco.
    commit(rows.filter((_, position) => position !== index));
    setPendingFocus({ index: Math.max(0, index - 1), place: "end" });
  };

  const insert = (item: Insertable) => {
    const field = activeRef.current;
    if (!field) return;

    // La forma corta es la que MathLive convierte en átomo: `\expandir` es una
    // macro suya, `\operatorname{expandir}` sería el nombre deletreado.
    field.insert(foldFunctions(item.template, functionNames), {
      insertionMode: "replaceSelection",
      selectionMode: "placeholder",
      focus: true,
    });
  };

  /** Cierra el popover metiendo en el campo lo que se había teclado. */
  const spillPopover = (current: Popover) => {
    setPopover(null);
    // Una barra sola no se escribe: en el campo abriría el modo de comandos de
    // MathLive, que es justo lo que se acaba de sustituir.
    if (current.query) activeRef.current?.insert(`\\${current.query}`);
  };

  const handlersFor = (index: number): MathFieldHandlers => ({
    onChange: (latex) => write(index, latex),

    onReady: (field) => {
      fieldsRef.current[index] = field;
    },

    onFocus: (field) => {
      activeRef.current = field;
    },

    /*
      Una flecha que se sale de la fila se va a la fila de al lado, y sólo se sale
      del bloque en los bordes. Antes «derecha» e «izquierda» salían siempre: con
      dos líneas, llegar al final de la primera te echaba del editor, que es lo
      contrario de lo que hace cualquier otro sitio donde se escribe.

      Arriba/abajo y adelante/atrás se tratan igual porque en un bloque de una
      línea por fila son el mismo movimiento.
    */
    onMoveOut: (direction) => {
      const back = direction === "upward" || direction === "backward";

      if (back) {
        if (index > 0) return setPendingFocus({ index: index - 1, place: "end" });
        return onCross(direction === "upward" ? "up" : "left");
      }
      if (index < rows.length - 1) return setPendingFocus({ index: index + 1, place: "start" });
      onCross(direction === "downward" ? "down" : "right");
    },

    onKeyDown: (event, field) => keyDown(event, field, index),
  });

  /* Quién se queda cada tecla. El orden importa: el popover manda mientras está
     abierto, y sólo después se mira la política del bloque. */
  const keyDown = (event: KeyboardEvent, field: MathfieldElement, index: number): boolean => {
    if (popover) return popoverKeyDown(event, popover);

    if (event.key === "\\") {
      const rect = field.getBoundingClientRect();
      setPopover({ query: "", index: 0, anchor: { left: rect.left, top: rect.bottom + 4 } });
      return true;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      onCompile();
      return true;
    }

    // Deshacer es de MathLive mientras el cursor está aquí: el del documento
    // revertiría el bloque entero por corregir un exponente. NotesApp mira el
    // objetivo del evento para no pisarlo (su oyente está en `window`).
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") return false;

    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      onMoveBlock(event.key === "ArrowUp" ? -1 : 1);
      return true;
    }

    if (event.key === "Escape") {
      onEscape();
      return true;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      addLineBelow(index);
      return true;
    }

    // Una línea vacía se borra; la última no, porque un bloque sin líneas no es
    // un bloque —de eso se encarga NotesApp, que sí puede borrarlo entero.
    if (event.key === "Backspace" && rows[index] === "" && rows.length > 1) {
      removeLine(index);
      return true;
    }

    return false;
  };

  const popoverKeyDown = (event: KeyboardEvent, current: Popover): boolean => {
    const matches = matchInsertables(current.query, groups ?? []);

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const last = Math.max(0, matches.length - 1);
      setPopover({ ...current, index: Math.min(Math.max(current.index + delta, 0), last) });
      return true;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      const picked = matches[current.index];
      // Sin candidato, lo teclado se inserta tal cual: `\overline` es LaTeX que el
      // motor acepta y la paleta no ofrece, y ésta es la puerta para escribirlo.
      if (!picked) {
        spillPopover(current);
        return true;
      }
      setPopover(null);
      insert(picked);
      return true;
    }

    if (event.key === "Escape") {
      spillPopover(current);
      return true;
    }

    if (event.key === "Backspace") {
      if (current.query === "") setPopover(null);
      else setPopover({ ...current, query: current.query.slice(0, -1), index: 0 });
      return true;
    }

    if (/^[a-zA-Z]$/.test(event.key)) {
      setPopover({ ...current, query: current.query + event.key, index: 0 });
      return true;
    }

    // Cualquier otra tecla cierra: lo teclado va al campo y la tecla sigue su
    // camino, que es lo que espera quien escribió `\alpha` y pulsó `(`.
    spillPopover(current);
    return false;
  };

  // Hasta que el motor contesta no hay filas: los nombres de sus funciones tienen
  // que estar antes de que un campo escriba su primer valor, o el bloque se abriría
  // con `\operatorname{expandir}` deletreado. `insertableGroups` siempre resuelve
  // —sin motor devuelve sólo los constructores— así que esto no se queda colgado.
  if (!groups) return <div className="h-7" aria-busy="true" />;

  return (
    <div>
      <MathPalette
        groups={groups}
        labels={labels}
        unsupportedHint={unsupportedHint}
        onInsert={insert}
      />

      <div className="space-y-0.5 px-2 pb-1">
        {rows.map((line, index) => (
          <MathFieldRow
            // Por índice a propósito: una línea no tiene identidad propia, y al
            // quitar una del medio lo que queda es la de abajo con otro texto.
            key={index}
            latex={line}
            autoFocus={index === seed.current.focus}
            focusPoint={focusPoint}
            functionNames={functionNames}
            handlers={handlersFor(index)}
          />
        ))}
      </div>

      {popover && (
        <MathCommandPopover
          query={popover.query}
          items={matchInsertables(popover.query, groups)}
          index={popover.index}
          anchor={popover.anchor}
          onPick={(item) => {
            setPopover(null);
            insert(item);
          }}
        />
      )}
    </div>
  );
}

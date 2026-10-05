import type { CSSProperties, ReactNode } from "react";

/*
  La superficie de un bloque de ecuación, en un solo sitio.

  La usan el modo lectura (MathRunner) y el de edición (MathBlockEditor, desde
  NotesApp), y por eso existe: si cada uno llevara sus clases, el bloque cambiaría
  de aspecto al entrar a escribir, que es exactamente cuando el usuario está
  mirando.

  Es `.glass` y no `bg-surface`. La nota de global.css avisa de que glass es chrome
  flotante y que las superficies de lectura larga van opacas «so math stays
  legible», y aquí se acepta el aviso a medias a propósito: un bloque de ecuación
  no es lectura larga, es una superficie de trabajo —se escribe, se resuelve, se
  cierra— y lo que se quería quitar era justo el aire de losa que lo hacía gemelo
  del bloque de código.

  El grano sí se apaga. El film de ruido de `.glass` es lo que hace que parezca
  cristal de verdad sobre chrome grande, y encima de glifos de 14 px es ruido y
  nada más.
*/
const SURFACE: CSSProperties = { "--glass-grain": "0" } as CSSProperties;

export default function MathSurface({ children }: { children: ReactNode }) {
  return (
    <div style={SURFACE} className="glass overflow-hidden rounded-[var(--radius-md)]">
      {children}
    </div>
  );
}

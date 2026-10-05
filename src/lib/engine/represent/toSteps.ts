/*
  ResultDoc -> pasos renderizables.

  Primera representación del motor, y a propósito no es la visual: si el
  objetivo primario son los pasos pedagógicos, lo primero que se construye son
  los pasos (04-roadmap.md, E0).

  Esto es data -> data. No renderiza nada: devuelve cadenas LaTeX que el
  componente pasa a KaTeX. La gráfica llega en E3, y llegará igual — derivada de
  hechos ya calculados, nunca como salida directa del motor.
*/

import type { ResultDoc, TraceStep } from "../types";

export interface Step {
  /** Número visible, empezando en 1. */
  index: number;
  /** El título que lee el estudiante. */
  title: string;
  /** El estado antes y después, en LaTeX renderizable. */
  before: string;
  after: string;
  /** Id estable de la regla, útil para enlazar la explicación larga. */
  rule: string;
  /**
   * Dónde disparó la regla dentro del árbol canónico. Vacío es la raíz.
   *
   * Todavía no se representa: resaltar el subtérmino en el LaTeX renderizado es
   * trabajo de la capa visual, y llega cuando haya un paso que lo necesite (E3).
   * Viaja desde ya para no cambiar el contrato dos veces.
   */
  path: number[];
  /** Teorema de Lean que respalda el paso, si lo hay. */
  soundness: string | null;
}

export function toSteps(document: ResultDoc): Step[] {
  return document.trace.map(toStep);
}

function toStep(step: TraceStep, position: number): Step {
  return {
    index: position + 1,
    title: step.title,
    before: step.before_latex,
    after: step.after_latex,
    rule: step.rule,
    path: step.path,
    soundness: step.soundness,
  };
}

/**
 * La aproximación decimal, ya formateada, o `null` si no la hay.
 *
 * Un resultado exacto grande puede no caber en un `f64`; en ese caso el motor no
 * manda aproximación y aquí no se inventa ninguna.
 */
export function decimalOf(document: ResultDoc): string | null {
  const approx = document.result?.numeric?.approx;
  if (approx === undefined) return null;

  // Los enteros se muestran enteros: "2", no "2.000000".
  if (Number.isInteger(approx)) return String(approx);
  return approx.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * La etiqueta de verificación que lee el estudiante. Un resultado sin verificar
 * sale marcado, no oculto (invariante 3).
 *
 * "Failed" no es "no se pudo": es que la comprobación se HIZO y el valor no
 * coincidió. Decirlo suave sería esconder el peor fallo que puede tener un CAS.
 */
export function verificationLabel(document: ResultDoc): string {
  switch (document.verification.status) {
    case "verified":
      return `Verificado (nivel ${document.verification.level})`;
    case "failed":
      return "La comprobación no cuadra";
    case "unverified":
      return "Sin verificar";
  }
}

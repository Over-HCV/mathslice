import KatexMath from "@/components/artifacts/KatexMath";
import type { Fact } from "@/lib/engine/types";

/*
  Los hechos del resultado: lo que el motor sabe además del valor.

  El motor computa y no representa, así que decidir que los divisores se pintan
  en una fila y la factorización en LaTeX es trabajo de aquí, no suyo. Desde E3
  esto es también de donde saldrá la gráfica.
*/

const SIGN_LABELS = {
  negative: "negativo",
  zero: "cero",
  positive: "positivo",
} as const;

const PARITY_LABELS = { even: "par", odd: "impar" } as const;

/* Los nombres de las posiciones viven aquí y no en el motor: son idioma, y el
   motor manda la potencia de diez (invariante 4). Fuera de este rango se dice la
   potencia y ya: «unidades de millón» y compañía se leen peor que 10^6. */
const PLACE_NAMES: Record<number, string> = {
  3: "millares",
  2: "centenas",
  1: "decenas",
  0: "unidades",
  [-1]: "décimas",
  [-2]: "centésimas",
  [-3]: "milésimas",
};

function placeName(exponent: number) {
  return PLACE_NAMES[exponent] ?? `× 10^${exponent}`;
}

const PRIMALITY_LABELS = {
  prime: "primo",
  composite: "compuesto",
  /* ±1 no es «no primo»: es una unidad, y la distinción es justo la que el
     estudiante trae confundida de casa. */
  unit: "ni primo ni compuesto (unidad)",
} as const;

export default function FactList({ facts }: { facts: Fact[] }) {
  if (facts.length === 0) return null;

  return (
    <section>
      <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
        Hechos
      </h2>
      <dl className="mt-3 space-y-2 rounded-[var(--radius-md)] border border-border bg-surface px-5 py-4">
        {facts.map((fact) => (
          <div key={fact.class} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <dt className="min-w-[7.5rem] font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
              {LABELS[fact.class]}
            </dt>
            <dd className="text-sm text-ink">{describe(fact)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const LABELS = {
  "graph-samples": "Puntos",
  sign: "Signo",
  parity: "Paridad",
  primality: "Primalidad",
  factorization: "Factorización",
  divisors: "Divisores",
  mixed: "Mixta",
  percent: "Porcentaje",
  decimal: "Decimal",
  periodic: "Periódico",
  "place-value": "Posiciones",
  "in-base": "En otra base",
} as const;

function describe(fact: Fact) {
  switch (fact.class) {
    case "sign":
      return SIGN_LABELS[fact.value];
    case "parity":
      return PARITY_LABELS[fact.value];
    case "primality":
      return PRIMALITY_LABELS[fact.value];
    case "factorization":
      /* Sin ningún factor hallado, el LaTeX es el número otra vez: escribirlo
         sería decir «n = n» y luego que n no se pudo factorizar. */
      if (fact.factors.length === 0) {
        return (
          <span className="text-ink-muted">
            ningún factor primo por debajo del tope; {fact.remaining} se quedó sin
            factorizar
          </span>
        );
      }
      return (
        <span className="flex flex-wrap items-baseline gap-2">
          <KatexMath math={fact.latex} />
          {fact.remaining !== null && (
            /* Un factor sin factorizar no es un fallo: es hasta dónde llegó el
               presupuesto, dicho en voz alta. */
            <span className="font-mono text-[11px] text-ink-muted">
              · {fact.remaining} se quedó sin factorizar
            </span>
          )}
        </span>
      );
    case "divisors":
      return (
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-[11px] text-ink-muted">{fact.count}:</span>
          {fact.values === null ? (
            <span className="text-ink-muted">demasiados para enumerarlos</span>
          ) : (
            <span className="font-mono text-sm">{fact.values.join(", ")}</span>
          )}
        </span>
      );
    case "decimal":
      /* Exacto, no aproximado: por eso va aquí y no en la línea del `≈`. */
      return <KatexMath math={fact.value} />;
    case "place-value":
      return (
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {fact.negative && <span className="font-mono text-[11px] text-ink-muted">negativo:</span>}
          {fact.digits.map(({ digit, exponent }) => (
            <span key={exponent} className="font-mono text-[13px]">
              {digit}{" "}
              <span className="text-[11px] text-ink-muted">{placeName(exponent)}</span>
            </span>
          ))}
        </span>
      );
    case "in-base":
      /* Las cifras llegan como números y el LaTeX ya escrito. Se pinta el LaTeX
         —`1011_{2}`, con la base donde el estudiante la espera— y las cifras se
         quedan disponibles para quien quiera pintarlas de otra forma. */
      return <KatexMath math={fact.latex} />;
    case "graph-samples":
      /* El motor da los puntos exactos y nada más: ni ejes, ni rango, ni color.
         Dibujarlos es de esta capa, y hasta que haya un componente de gráfica
         se dice cuántos hay y en qué variable — que es más honesto que pintar
         una curva a medias. */
      return (
        <span className="font-mono text-[13px] text-ink-muted">
          {fact.points.length} puntos en {fact.variable}, exactos
        </span>
      );
    case "mixed":
    case "percent":
    case "periodic":
      /* El LaTeX lo escribe el motor: aquí no se vuelve a hacer la división ni
         se decide dónde va el signo. Esto sólo elige que se pinte renderizado. */
      return <KatexMath math={fact.latex} />;
    default:
      /* Si el motor gana una clase de hecho, esto deja de compilar — que es lo
         que impide que llegue al navegador sin que nadie decida cómo se ve. */
      return exhausted(fact);
  }
}

function exhausted(fact: never): never {
  throw new Error(`clase de hecho sin representación: ${JSON.stringify(fact)}`);
}

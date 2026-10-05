/*
  Lo que el editor de matemáticas puede ofrecer: la paleta de arriba y el popover
  que sale al teclear `\`.

  La regla es una: **sólo se ofrece lo que el motor sabe leer**. El parser
  (`engine/crates/ms-parse/src/lexer.rs`) es una lista corta y cerrada, y todo lo
  que no está en ella —`\sqrt`, `\pi`, `\sin`, `raiz`, los subíndices— vuelve como
  `unknown-command`. Una paleta con un botón de raíz cuadrada no es una paleta
  generosa: es una que promete algo que el motor rechaza, y el estudiante lee ese
  rechazo como que la aplicación está rota.

  De ahí el reparto:

  - Las FUNCIONES se preguntan al motor (`functions()` en runner.ts). Crecen solas
    cuando una etapa añade una, y no hay lista que se quede corta.
  - Los CONSTRUCTORES son la gramática del parser, no una capacidad: `\frac`, `^`,
    `\cdot`… no cambian cuando el motor aprende a derivar. Van escritos aquí, y
    `engine/scripts/browser-check.mjs` los pasa por `probe` para que ninguno mienta.

  Aquí no hay palabras traducibles a propósito: cada elemento se muestra con el
  LaTeX que produce (pintado con KaTeX) y se nombra con el comando que se teclea.
  Un botón que se ve `a/b` no necesita que le digan «fracción» en dos idiomas.
*/

import { functions } from "./runner";
import { rankByKeys } from "@/lib/fuzzy";

/** Dónde va el cursor tras insertar. Es la notación de huecos de MathLive. */
const HOLE = "#?";

export interface Insertable {
  /** Estable: clave de React y del filtro. */
  id: string;
  /** Lo que se teclea tras `\` para llegar aquí. En minúsculas. */
  keys: string[];
  /** El comando tal y como se escribe. Es el nombre accesible del botón. */
  command: string;
  /** LaTeX de muestra, con letras de ejemplo, para pintar en el botón. */
  preview: string;
  /**
   * LaTeX que se inserta. Cada `#?` es un hueco donde puede caer el cursor.
   * Vacío en lo que el motor todavía no lee: no hay nada que insertar.
   */
  template: string;
  /**
   * ¿Lo lee el motor hoy?
   *
   * Lo que no, se muestra **apagado** en vez de esconderse. Esconderlo dejaría al
   * estudiante buscando la raíz cuadrada sin saber si está en otro menú o no
   * existe; apagado con su explicación dice lo que hay: el motor aún no la sabe
   * leer. Y cuando la sepa, el botón se enciende cambiando este campo.
   */
  supported: boolean;
}

/** Las categorías de la paleta. La etiqueta la pone la interfaz, que sabe el idioma. */
export type InsertableGroupId = "functions" | "operations" | "structure" | "greek" | "analysis";

export interface InsertableGroup {
  id: InsertableGroupId;
  /** El símbolo que representa la categoría en la barra. LaTeX, se pinta con KaTeX. */
  icon: string;
  items: Insertable[];
}

/*
  La gramática que acepta el lexer, en el orden en que se usa escribiendo.

  `\left(…\right)` y no `(…)` porque es exactamente lo que el escritor del motor
  emite (`ms-serialize/src/latex.rs`), así que lo que el estudiante escribe y lo
  que el motor le devuelve se ven iguales.

  Fuera de esta lista, y con motivo:

  - `\%`, `\overline{…}` (el periódico) y las bases `_{…}` son notación que se
    escribe SOBRE un número, no en el vacío: un botón que inserta `\%` sin número
    delante deja la línea sin parsear.
  - `\left\{…\right\}` sólo vale en la raíz de la línea (`parse_root` en
    `parser.rs`), así que como botón funcionaría a veces. Los conjuntos de
    soluciones son lo que el motor **devuelve**, no lo que se le pregunta.
*/
/** Lo que el motor lee: se escribe, se resuelve. */
const reads = (item: Omit<Insertable, "supported">): Insertable => ({ ...item, supported: true });

/**
 * Lo que el motor **todavía** no lee: se ve, se explica, no se inserta.
 *
 * Sin plantilla a propósito. Un `template` en algo apagado sería un botón esperando
 * a que alguien le quite el `disabled` sin comprobar si el parser ya lo acepta.
 */
const pending = (id: string, command: string, preview: string): Insertable => ({
  id,
  keys: [],
  command,
  preview,
  template: "",
  supported: false,
});

/** Lo que se pone ENTRE dos cosas: aritmética elemental. */
const OPERATIONS: Insertable[] = [
  reads({
    id: "cdot",
    keys: ["cdot", "por", "producto", "multiplicar"],
    command: "\\cdot",
    preview: "a\\cdot b",
    template: `${HOLE}\\cdot ${HOLE}`,
  }),
  reads({
    id: "times",
    keys: ["times", "por", "producto", "multiplicar"],
    command: "\\times",
    preview: "a\\times b",
    template: `${HOLE}\\times ${HOLE}`,
  }),
  reads({
    // `/` en el campo produce fracción, así que la división en línea necesita su
    // propio botón. Es la que se enseña en primaria y la que usa el corpus de E1.
    id: "div",
    keys: ["div", "entre", "dividir", "division"],
    command: "\\div",
    preview: "a\\div b",
    template: `${HOLE}\\div ${HOLE}`,
  }),
  reads({
    id: "equation",
    keys: ["igual", "equals", "ecuacion", "equation", "resolver"],
    command: "=",
    preview: "a=b",
    template: `${HOLE}=${HOLE}`,
  }),
  reads({
    id: "parens",
    keys: ["parentesis", "parens", "grupo", "agrupar"],
    command: "\\left(\\right)",
    preview: "\\left(a\\right)",
    template: `\\left(${HOLE}\\right)`,
  }),
  pending("pm", "\\pm", "a\\pm b"),
];

/** Lo que tiene partes: se escribe alrededor de los huecos, no entre ellos. */
const STRUCTURE: Insertable[] = [
  reads({
    id: "frac",
    keys: ["frac", "fraccion", "fraction", "dividir"],
    command: "\\frac",
    preview: "\\frac{a}{b}",
    template: `\\frac{${HOLE}}{${HOLE}}`,
  }),
  reads({
    id: "power",
    keys: ["power", "potencia", "exponente", "cuadrado"],
    command: "^",
    preview: "a^{b}",
    template: `${HOLE}^{${HOLE}}`,
  }),
  // El subíndice no es una variable con índice: `_` es notación de base
  // (`x_{2}` = «x en base 2», lexer.rs), así que `x_{1}` no significa lo que
  // parece y sale `unsupported-base`.
  pending("subscript", "_", "a_{b}"),
];

/*
  Las griegas. Todas apagadas hoy: los símbolos del motor son letras ASCII sueltas
  (`lexer.rs`), así que `\pi` es `unknown-command` y `2\pi` no es «dos pi», es un
  error de sintaxis.

  Están porque se buscan —es lo primero que uno mira en una paleta— y porque
  apagadas dicen la verdad: el motor todavía no las lee.
*/
const GREEK: Insertable[] = [
  pending("alpha", "\\alpha", "\\alpha"),
  pending("beta", "\\beta", "\\beta"),
  pending("gamma", "\\gamma", "\\gamma"),
  pending("delta", "\\delta", "\\delta"),
  pending("theta", "\\theta", "\\theta"),
  pending("lambda", "\\lambda", "\\lambda"),
  pending("mu", "\\mu", "\\mu"),
  pending("pi", "\\pi", "\\pi"),
  pending("sigma", "\\sigma", "\\sigma"),
  pending("phi", "\\phi", "\\phi"),
  pending("omega", "\\omega", "\\omega"),
];

/*
  Análisis: la raíz, los límites, las sumas y las trigonométricas.

  Ninguna entra hoy. La raíz es la que más se pide y la que más se da por hecha
  —hay un test que exige que `\operatorname{raiz}(4)` falle (`ms-parse/src/lib.rs`)—
  y las trigonométricas son E4. Aquí se ven, apagadas, en vez de dejar al
  estudiante buscándolas por los menús.
*/
const ANALYSIS: Insertable[] = [
  pending("sqrt", "\\sqrt", "\\sqrt{a}"),
  pending("nthroot", "\\sqrt[n]", "\\sqrt[n]{a}"),
  pending("sin", "\\sin", "\\sin a"),
  pending("cos", "\\cos", "\\cos a"),
  pending("tan", "\\tan", "\\tan a"),
  pending("log", "\\log", "\\log a"),
  pending("ln", "\\ln", "\\ln a"),
  pending("sum", "\\sum", "\\sum_{i}^{n}"),
  pending("prod", "\\prod", "\\prod_{i}^{n}"),
  pending("int", "\\int", "\\int a"),
  pending("infty", "\\infty", "\\infty"),
];

/**
 * La llamada a una función, escrita a partir de su nombre y su aridad.
 *
 * No hay tabla que mantener: el motor dice que `mcd` toma dos argumentos y de ahí
 * sale `\operatorname{mcd}\left(#?, #?\right)`. Cuando E4 añada una función, su
 * botón aparece sin que nadie lo escriba.
 *
 * Cuidado con lo que NO se puede derivar de la aridad: el orden de los argumentos.
 * `enBase(2, 11)` lleva la base delante y `derivar(f, x)` la variable detrás
 * (ver `ms-core/src/node.rs`), y los huecos vacíos no lo dicen. Eso lo enseña la
 * documentación del motor, no la paleta.
 */
function callOf(name: string, arity: number): Insertable {
  const holes = Array.from({ length: arity }, () => HOLE).join(", ");
  const sample = ["a", "b", "c"].slice(0, arity).join(", ");

  return reads({
    id: `fn-${name}`,
    keys: [name.toLowerCase()],
    command: name,
    preview: `\\operatorname{${name}}\\left(${sample}\\right)`,
    template: `\\operatorname{${name}}\\left(${holes}\\right)`,
  });
}

/**
 * Todo lo insertable, agrupado. Las funciones vienen del motor; los
 * constructores, de la gramática.
 *
 * Si el motor no contesta, se devuelven los constructores igualmente: media
 * paleta es útil, y ninguna paleta por un worker lento no lo es.
 */
export async function insertableGroups(): Promise<InsertableGroup[]> {
  let calls: Insertable[] = [];
  try {
    calls = (await functions()).map((entry) => callOf(entry.name, entry.arity));
  } catch {
    calls = [];
  }

  // El orden es el de la barra, y va de lo que más se usa a lo que todavía no se
  // puede usar. El icono es el símbolo que mejor dice qué hay dentro.
  return [
    { id: "functions", icon: "f\\left(x\\right)", items: calls },
    { id: "operations", icon: "+", items: OPERATIONS },
    { id: "structure", icon: "\\frac{a}{b}", items: STRUCTURE },
    { id: "greek", icon: "\\pi", items: GREEK },
    { id: "analysis", icon: "\\sqrt{x}", items: ANALYSIS },
  ];
}

/**
 * Lo que casa con lo que se lleva teclado tras `\`, mejor primero.
 *
 * Mismo orden que el menú `/` de bloques porque es el mismo gesto: `\exp` pone
 * `expandir` arriba por prefijo, y `\po` encuentra la potencia por subsecuencia.
 *
 * Lo apagado no sale: aquí se está tecleando para insertar, y una sugerencia que
 * no se puede elegir sólo estorba. En la paleta sí se ve, que es donde uno mira
 * para saber qué existe.
 */
export function matchInsertables(query: string, groups: InsertableGroup[]): Insertable[] {
  const all = groups.flatMap((group) => group.items).filter((item) => item.supported);
  return rankByKeys(query, all, (item) => [item.command, ...item.keys]);
}

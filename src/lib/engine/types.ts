/*
  Espejo en TypeScript del contrato de salida del motor.

  La fuente de verdad es Rust: `engine/crates/ms-serialize/src/result.rs`. Si
  cambias una forma allí, cambia aquí — el test `golden_result_doc` de ese crate
  compara contra `engine/corpus/e0.json`, así que un cambio de forma rompe el
  build de Rust y este archivo es lo siguiente que hay que tocar.

  El motor computa, no representa: aquí no hay colores, ni tamaños, ni viewport.
  Sólo hechos matemáticos y la derivación que lleva a ellos.
*/

/** Un árbol de expresión estructural. Los enteros van como cadena: son bignum. */
export type Expr =
  | { int: string }
  | { rat: [string, string] }
  | { sym: string }
  | { h: "Plus" | "Times" | "Power"; a: Expr[] }
  /**
   * Una función con nombre. El nombre viaja en su **propio** campo y no dentro
   * de `h`: así `h` sigue siendo un conjunto cerrado sobre el que se puede
   * discriminar, en vez de una cadena libre que hay que volver a interpretar.
   */
  | { h: "Fn"; fn: string; a: Expr[] }
  | { h: "Equal"; a: [Expr, Expr] }
  | { h: "Solutions"; a: Expr[] };

export interface Span {
  start: number;
  end: number;
}

/**
 * Qué clase de respuesta trae el documento.
 *
 * `solutions` es el conjunto de soluciones de una ecuación, y es una clase
 * propia porque no se lee como una expresión suelta: son varias respuestas, no
 * una. Su árbol es `{ h: "Solutions", a: [{ h: "Equal", ... }] }`.
 */
export type ResultKind = "number" | "expression" | "solutions";

export interface Numeric {
  approx: number;
}

export interface ResultValue {
  kind: ResultKind;
  expr: Expr;
  latex: string;
  /** La aproximación decimal, si el resultado es un número. El exacto manda. */
  numeric: Numeric | null;
}

/** Un paso de la derivación: el objetivo primario del motor. */
export interface TraceStep {
  /** Id estable de la regla. Sobrevive a cambios de nombre y de redacción. */
  rule: string;
  /** El título que lee el estudiante. */
  title: string;
  before: Expr;
  before_latex: string;
  after: Expr;
  after_latex: string;
  /**
   * Dónde disparó la regla: los índices de argumento desde la raíz del árbol
   * canónico hasta el subtérmino reescrito. Vacío significa "en la raíz".
   *
   * `before` y `after` son fotos del árbol entero. El locus es lo que permitirá
   * señalar "derivamos ESTE subtérmino" cuando lleguen las derivadas en E3.
   */
  path: number[];
  /** Teorema de Lean que respalda la regla, cuando lo hay. */
  soundness: string | null;
}

/** Un primo con su multiplicidad: el `2^{2}` de `12 = 2^{2} \cdot 3`. */
export interface PrimePower {
  /** Bignum, por eso cadena. */
  prime: string;
  exponent: number;
}

/**
 * Lo que el motor sabe del resultado además de su valor.
 *
 * Unión discriminada por `class`: quien dibuje los divisores necesita los
 * divisores, no una cadena que tenga que volver a parsear.
 *
 * Cada clase de valor afirma lo suyo: un entero trae hasta cinco clases, una
 * fracción impropia trae su vista mixta, y una fracción propia no trae ninguna
 * — que también es una respuesta.
 */
export type Fact =
  | { class: "sign"; value: "negative" | "zero" | "positive" }
  | { class: "parity"; value: "even" | "odd" }
  /** `unit` es ±1: ni primo ni compuesto. */
  | { class: "primality"; value: "prime" | "composite" | "unit" }
  | {
      class: "factorization";
      factors: PrimePower[];
      /** Lo que el presupuesto no alcanzó a factorizar. `null` = completa. */
      remaining: string | null;
      latex: string;
    }
  | {
      class: "divisors";
      count: number;
      /** `null` cuando hay demasiados para enumerarlos; `count` sigue valiendo. */
      values: string[] | null;
    }
  /**
   * La vista mixta de una fracción impropia. Las tres partes son **magnitudes**
   * y el signo va en `negative`, porque en una mixta afecta al conjunto:
   * `-2\frac{1}{3}` es `-\frac{7}{3}`, no `-2 + \frac{1}{3}`.
   *
   * Es una vista de salida y no una forma de entrada: el motor no acepta mixtas
   * escritas, y un entero pegado a una fracción es el producto que la notación
   * dice que es.
   */
  | {
      class: "mixed";
      whole: string;
      numerator: string;
      denominator: string;
      negative: boolean;
      latex: string;
    }
  /**
   * El valor como porcentaje, y sólo cuando `100 · valor` es entero: `\frac{1}{3}`
   * no lo trae, porque `33.33\%` sería redondear sin que nadie lo pidiera.
   *
   * Aquí el signo va **dentro** de `value`, al contrario que en `mixed`: no hay
   * parte entera de la que despegarlo.
   */
  | { class: "percent"; value: string; latex: string }
  /**
   * El valor en forma decimal **exacta**, cuando su denominador sólo tiene
   * factores 2 y 5. No es la aproximación de `numeric.approx`: `\frac{173}{50}`
   * es `3.46` y punto, sin `≈`.
   *
   * No lleva `latex` aparte porque un decimal escrito ya es su propio LaTeX.
   */
  | { class: "decimal"; value: string }
  /**
   * El desarrollo periódico, cuando el decimal no es finito: `\frac{1}{6}` es
   * `0.1\overline{6}`. Complemento exacto de `decimal`: un racional no entero
   * trae uno o el otro, nunca los dos.
   *
   * Las tres partes viajan sueltas además del LaTeX, para quien quiera pintar la
   * barra a su manera sin volver a parsear la cadena.
   */
  | {
      class: "periodic";
      whole: string;
      nonrepeating: string;
      repeating: string;
      negative: boolean;
      latex: string;
    }
  /**
   * Qué vale cada cifra por su posición, de la más significativa a la menos.
   * `exponent` es la potencia de diez: `2` centenas, `0` unidades, `-1`
   * décimas. Los nombres de las posiciones son idioma y los pone esta capa.
   */
  | {
      class: "place-value";
      digits: { digit: number; exponent: number }[];
      negative: boolean;
    }
  /**
   * El valor escrito en la base que se pidió con `\operatorname{enBase}(b, x)`.
   * Es el único hecho que responde a una petición y no al valor, así que solo
   * aparece cuando alguien la escribió.
   *
   * `digits` son números, de la cifra más significativa a la menos, para quien
   * quiera pintarlas de otra forma; `latex` trae ya la notación de siempre, con
   * las cifras por encima de nueve escritas con letra.
   */
  | {
      class: "in-base";
      digits: number[];
      base: number;
      negative: boolean;
      latex: string;
    }
  /**
   * Puntos de una expresión con una variable libre, para que los pinte quien
   * quiera. El motor es agnóstico del graficador: no hay ejes, ni rango de
   * vista, ni color — eso es representación y vive aquí, no en el motor.
   *
   * Las coordenadas son EXACTAS y vienen como cociente de enteros ("3", "-1/2"):
   * redondear a número sería una decisión de presentación tomada donde no se
   * toman. Los puntos donde la expresión no está definida no aparecen.
   */
  | {
      class: "graph-samples";
      variable: string;
      points: { x: string; y: string }[];
    };

export type VerificationStatus = "unverified" | "verified" | "failed";

/**
 * Cómo se comprobó el resultado. El nivel solo no basta: "evaluado exactamente
 * en ℚ" y "muestreado en 30 puntos" son ambos nivel 0 y no valen lo mismo.
 */
export type VerificationMethod =
  | "none"
  | "exact-rational"
  /** Nivel 1: cada solución sustituida en la ecuación original. */
  | "symbolic-substitution"
  /** Nivel 0 con una variable libre: evaluado en varios puntos racionales fijos. */
  | "rational-sampling"
  /**
   * Nivel 0 de una derivada: el valor de la entrada en cada punto sale de
   * derivar EVALUANDO — números duales, ε² = 0, aritmética exacta en ℚ. El
   * verificador no ve el código que deriva, así que no puede repetir su error.
   */
  | "dual-sampling";

/**
 * Invariante 3: si un resultado no se pudo verificar, sale MARCADO, no oculto.
 */
export interface Verification {
  level: number;
  status: VerificationStatus;
  method: VerificationMethod;
}

export interface EngineError {
  kind: string;
  message: string;
  /** Rango de bytes sobre el LaTeX de entrada, para subrayar donde toca. */
  span: Span | null;
}

/**
 * Una función que el motor sabe leer, tal y como la publica `surface()`.
 *
 * El nombre es el que se escribe dentro de `\operatorname{…}` y la aridad es
 * cuántos argumentos exige el parser — con eso, y sólo con eso, la interfaz
 * construye la llamada. Cómo se etiqueta y en qué idioma es cosa de la interfaz:
 * el motor no representa.
 */
export interface EngineFunction {
  name: string;
  arity: number;
}

export interface ResultDoc {
  input: { latex: string; expr: Expr | null };
  result: ResultValue | null;
  /** Vacío cuando el motor no sabe nada del resultado que merezca decirse. */
  facts: Fact[];
  trace: TraceStep[];
  verification: Verification;
  error: EngineError | null;
  /** Lo rellena el worker: el WASM no tiene reloj. */
  timing_ms: number;
}

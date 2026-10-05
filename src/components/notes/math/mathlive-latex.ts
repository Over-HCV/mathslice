/*
  Traducción entre lo que MathLive edita y lo que el motor lee. Dos direcciones y
  ninguna simétrica, así que las dos están escritas.

  Hacia el documento: la forma larga, `\operatorname{expandir}`, que es la única
  que el parser conoce. `\expandir` es una macro de este editor y no existe fuera.

  Hacia el editor: la forma corta, para que `\operatorname{expandir}` vuelva a ser
  el átomo que era antes de recargar la página. Sin este paso, un documento
  guardado se reabre con el nombre de la función deletreado carácter a carácter:
  el cursor se mete dentro, un borrado deja `\operatorname{expandi}`, y lo que se
  veía sólido deja de serlo sin que el usuario haya cambiado nada.
*/

/** Lo que MathLive deja donde falta algo. KaTeX no lo conoce y lo pintaría en rojo. */
const PLACEHOLDER = /\\placeholder(?:\[[^\]]*\])?\{([^{}]*)\}/g;

/**
 * MathLive escribe el nombre de la función en redonda **explícita** al expandir:
 * `\operatorname{\mathrm{expandir}}`.
 *
 * Para él es lo mismo —`\operatorname` ya va en redonda— pero para el parser no:
 * `\operatorname{` tiene que llevar letras ASCII pegadas y su `}` (`read_braced_name`
 * en `lexer.rs`), así que con el `\mathrm` dentro la línea es un error de sintaxis.
 * Es la clase de detalle que no falla al escribir sino al resolver, y entonces
 * parece que el motor no sabe expandir.
 */
const UPRIGHT_NAME = /\\operatorname\{\\mathrm\{([a-zA-Z]+)\}\}/g;

/**
 * `\operatorname{expandir}` → `\expandir`, para las funciones que se le pasan.
 *
 * El espacio detrás no es cosmético: `\operatorname{mcd}x` tiene que salir como
 * `\mcd x` y no como `\mcdx`, que sería el nombre de otro comando —uno que no
 * existe. Sólo se añade cuando lo siguiente es una letra, para no ensuciar el
 * caso normal, que es un paréntesis.
 */
export function foldFunctions(latex: string, names: string[]): string {
  let folded = latex;

  for (const name of names) {
    const long = `\\operatorname{${name}}`;
    const parts = folded.split(long);

    // Lo que decide el espacio es cómo empieza el trozo que va detrás, así que
    // se pega parte a parte en vez de con qué carácter había en tal posición.
    folded = parts.reduce((joined, part) => {
      const short = /^[a-zA-Z]/.test(part) ? `\\${name} ` : `\\${name}`;
      return joined + short + part;
    });
  }

  return folded;
}

/**
 * Lo que se guarda en el documento: LaTeX largo y sin huecos.
 *
 * Los huecos vacíos se van en vez de guardarse. Un `\placeholder{}` en el
 * markdown sería un símbolo que KaTeX pinta como error al leer el documento, y
 * además viajaría al export. Que la línea quede incompleta —y por tanto sin
 * botón de resolver— es la lectura correcta: está a medio escribir.
 */
export function toDocument(expanded: string): string {
  return expanded.replace(UPRIGHT_NAME, "\\operatorname{$1}").replace(PLACEHOLDER, "$1").trim();
}

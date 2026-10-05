/*
  Filtro difuso compartido por los dos menús que se escriben tecleando: el menú
  `/` de bloques y el popover `\` del editor de matemáticas.

  Vive aquí porque son el mismo gesto —el usuario teclea un trozo del nombre y
  espera ver lo que buscaba primero— y dos implementaciones acabarían ordenando
  distinto para la misma consulta.
*/

/** ¿Están las letras de `query` dentro de `text`, en ese orden? */
export function isSubsequence(query: string, text: string): boolean {
  let matched = 0;
  for (let i = 0; i < text.length && matched < query.length; i++) {
    if (text[i] === query[matched]) matched++;
  }
  return matched === query.length;
}

/**
 * Ordena `items` por lo bien que casan con la consulta, y descarta lo que no casa.
 *
 * El prefijo gana a la subsecuencia: quien teclea `exp` quiere `expandir` antes
 * que cualquier cosa que contenga esas letras sueltas. Una consulta vacía
 * devuelve todo en su orden original, que es el orden en que se declaró.
 *
 * `keysOf` da los nombres por los que se puede encontrar un elemento. Se
 * comparan en minúsculas, así que las claves conviene declararlas ya así.
 */
export function rankByKeys<T>(query: string, items: T[], keysOf: (item: T) => string[]): T[] {
  const needle = query.toLowerCase().trim();
  if (!needle) return items;

  const PREFIX = 0;
  const SUBSEQUENCE = 1;
  const NO_MATCH = Infinity;

  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    let best = NO_MATCH;
    for (const key of keysOf(item)) {
      const lowered = key.toLowerCase();
      if (lowered.startsWith(needle)) best = Math.min(best, PREFIX);
      else if (isSubsequence(needle, lowered)) best = Math.min(best, SUBSEQUENCE);
    }
    if (best < NO_MATCH) scored.push({ item, score: best });
  }

  // Estable, así que dentro del mismo score manda el orden de declaración.
  scored.sort((a, b) => a.score - b.score);
  return scored.map((entry) => entry.item);
}

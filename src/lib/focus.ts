/*
  Enfocar sin mover la página.

  Al enfocar un elemento, el navegador lo trae a la vista. Es lo correcto cuando el
  foco llega por teclado desde lejos, y es molesto cuando el usuario acaba de hacer
  clic en algo que ya estaba mirando: abrir un bloque de ecuación o de código lo
  cambia por otro más alto, el navegador intenta centrar el nuevo, y la página da un
  salto. Si el bloque es el último del documento, encima se va a un sitio donde no
  se ve entero.

  El clic ya dice dónde está mirando el usuario. La cámara es suya.
*/

/**
 * Enfoca `element` dejando la página donde estaba.
 *
 * `preventScroll` basta para casi todo. Se comprueba y se restaura además porque
 * hay elementos que enfocan algo de su interior —MathLive enfoca un textarea dentro
 * de su shadow DOM— y en ese salto las opciones no viajan.
 */
export function focusWithoutScroll(element: HTMLElement) {
  const x = window.scrollX;
  const y = window.scrollY;

  element.focus({ preventScroll: true });

  if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y);
}

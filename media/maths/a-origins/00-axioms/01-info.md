---
title: Información — Axiomas
level: info
---

## El mecanismo: de axioma a teorema

Elegir `A` no es elegir un conjunto de "verdades" — es elegir un **punto de partida**. Todo lo que el sistema puede llegar a decir está ya implícito en `A` + `R`; un teorema no añade información nueva al sistema, la hace *explícita*. Esto es lo que separa un sistema axiomático de una lista de observaciones: aquí nada entra que no estuviera ya permitido por las reglas.

Ejemplo trabajado — de los axiomas de grupo se deriva la **unicidad del inverso** sin añadir ningún axioma nuevo:

```
Sea a·b = e y a·c = e (b, c ambos inversos de a)
b = b·e            (identidad)
  = b·(a·c)         (sustitución: e = a·c)
  = (b·a)·c         (asociatividad)
  = e·c             (b·a = e, por hipótesis)
  = c               (identidad)
∴ b = c — el inverso es único
```

Ningún paso usa nada fuera de los 4 axiomas de grupo. Esto es la relación central del nivel Dato: los axiomas no son una lista plana, son **generadores** — de un puñado de reglas mínimas sale toda la estructura del tema.

## Independencia como relación observable

El postulado de las paralelas de Euclides es el ejemplo más ilustrativo de qué significa que un axioma sea *independiente* de los demás: durante ~2000 años se intentó *derivarlo* de los otros 4 (tratarlo como teorema, no axioma). Fracasó siempre — porque es genuinamente independiente. La prueba llegó al revés: se construyeron modelos que satisfacen los primeros 4 postulados pero **no** el quinto (geometría hiperbólica, geometría esférica). Existencia de un modelo que cumple `A \ {φ}` pero no `φ` ⟺ prueba de independencia. Esta es la técnica general: independencia se demuestra con modelos, no con derivaciones.

::embed[Los 2000 años que costó aceptarlo]{ref="a-origins/00-axioms/know#historia-de-la-evidencia-a-la-convención"}

## Diagrama conceptual del sistema formal

```
   Lenguaje L (símbolos + gramática)
            │
            ▼
     Axiomas A ⊆ L  ──┐
            │          │ Reglas de inferencia R
            ▼          │  (modus ponens, generalización...)
      Teoremas (A ⊢ φ) ◄┘
            │
            ▼
   Modelos M ⊨ A  (estructuras que "encarnan" los axiomas)
```

La flecha de doble sentido entre Axiomas/Teoremas y Modelos es la relación sintaxis↔semántica: `A ⊢ φ` (se puede *derivar*) y `A ⊨ φ` (es *verdad en todo modelo*) coinciden en lógica de primer orden (teorema de completitud de Gödel, 1929 — no confundir con los teoremas de *incompletitud*, 1931).

## Cómo se relacionan consistencia, independencia y completitud

- Un sistema **inconsistente** deriva cualquier fórmula (principio de explosión: `φ ∧ ¬φ ⊢ ψ` para toda `ψ`) — es inútil como sistema, deriva todo y por tanto no distingue nada.
- Un axioma **dependiente** (no independiente) es ruido: quitarlo no cambia el conjunto de teoremas. Un sistema mínimo (todos sus axiomas independientes) es la forma "comprimida" de la misma teoría.
- **Completitud** es la propiedad más frágil de las tres: ZFC y Peano son consistentes (se cree/asume) pero *no* completos — hay enunciados ni derivables ni refutables dentro del sistema (número de esta relación desarrollado en `03-godel-incompleteness-theorems`, aquí solo se nombra la conexión).

## Cambiar un axioma cambia el universo entero

La relación más importante para intuir: **el conjunto de axiomas es lo único que separa una teoría de otra**. Cambiar un solo axioma (quitar/negar el 5º postulado) no da "una versión rota" de la geometría euclidiana — da una geometría igual de válida y consistente (hiperbólica/elíptica), simplemente distinta. Esto es lo que conecta este tema hacia afuera: la elección de axiomas es un grado de libertad real del matemático, no una restricción impuesta por la naturaleza — ese salto es contenido de Conocimiento (`02-know.md`).

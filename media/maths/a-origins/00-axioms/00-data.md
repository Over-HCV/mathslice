---
title: Dato — Axiomas
level: data
---

## Definiciones formales

**Sistema formal.** Una tupla `(L, A, R)` donde:
- `L` — lenguaje formal: alfabeto de símbolos + gramática que genera las fórmulas bien formadas (fbf).
- `A ⊆ L` — conjunto de axiomas: fbf distinguidas, aceptadas sin prueba dentro del sistema.
- `R` — reglas de inferencia: relaciones que permiten derivar fbf nuevas a partir de otras ya aceptadas (ej. *modus ponens*: de `p` y `p → q`, derivar `q`).

**Axioma.** Fórmula bien formada `φ ∈ A` tal que `⊢ φ` por definición (no requiere derivación; es punto de partida).

**Teorema.** Fórmula `φ` tal que existe una secuencia finita `φ₁, ..., φₙ = φ` donde cada `φᵢ` es un axioma, o se obtiene de fórmulas anteriores en la secuencia mediante una regla de `R`. Notación: `A ⊢ φ`.

**Modelo.** Estructura matemática `M` que satisface todos los axiomas de `A`. Notación: `M ⊨ A`. Un teorema `φ` es *válido* si `M ⊨ A ⟹ M ⊨ φ` para todo modelo `M`.

## Taxonomía

| Categoría | Definición |
|---|---|
| Axioma lógico | Válido en cualquier estructura, independiente del dominio (ej. `p ∨ ¬p`) |
| Axioma no-lógico (propio) | Específico del sistema/teoría (ej. axiomas de grupo, axiomas de Peano) |
| Esquema de axiomas | Plantilla que genera infinitos axiomas al instanciar una variable (ej. esquema de inducción de Peano, esquema de comprensión/reemplazo en ZFC) |
| Postulado | Sinónimo histórico de axioma no-lógico (uso de Euclides) |
| Definición | No es axioma: introduce notación abreviada, no añade poder deductivo |
| Lema | Teorema instrumental, subordinado a un resultado posterior |
| Corolario | Teorema que se sigue de otro con derivación mínima adicional |
| Conjetura | Enunciado propuesto, sin `⊢` ni refutación conocida |

## Propiedades de un sistema axiomático `(L, A, R)`

- **Consistencia**: no existe `φ` tal que `A ⊢ φ` y `A ⊢ ¬φ`. Equivalente (por completitud semántica en lógica de primer orden) a: existe al menos un modelo `M ⊨ A`.
- **Independencia**: para todo `φ ∈ A`, `A \ {φ} ⊬ φ`. Un axioma dependiente es redundante (se puede derivar de los demás) y por tanto no es, estrictamente, un axioma.
- **Completitud (sintáctica)**: para toda fbf `φ` del lenguaje, `A ⊢ φ` o `A ⊢ ¬φ`.
- **Categoricidad**: todos los modelos de `A` son isomorfos entre sí.
- Estas cuatro propiedades son mutuamente independientes entre sí como propiedades de un sistema — ningún par implica al resto. La imposibilidad de tener consistencia + completitud simultáneamente en sistemas suficientemente expresivos es el contenido de `a-origins/01-mathematical-logic/03-godel-incompleteness-theorems`.

## Instancias canónicas (enunciado, sin desarrollo)

- **Postulados de Euclides** (5): 1) trazar una recta entre dos puntos, 2) prolongar un segmento indefinidamente, 3) trazar un círculo dado centro y radio, 4) todos los ángulos rectos son iguales, 5) postulado de las paralelas (formulación de Playfair: por un punto exterior a una recta pasa una única paralela).
- **Axiomas de Peano** (aritmética de `ℕ`): existe `0`; toda `n` tiene sucesor único `S(n)`; `S(n) ≠ 0` para toda `n`; `S` es inyectiva; esquema de inducción: `(P(0) ∧ ∀n(P(n) → P(S(n)))) → ∀n P(n)`.
- **Axiomas de grupo** `(G, ·)`: clausura, asociatividad `(a·b)·c = a·(b·c)`, existencia de identidad `e` tal que `e·a = a·e = a`, existencia de inverso `a⁻¹` tal que `a·a⁻¹ = a⁻¹·a = e`.
- **ZFC** (Zermelo-Fraenkel + Axioma de Elección): 9 axiomas + 2 esquemas — extensionalidad, par, unión, conjunto potencia, infinitud, regularidad, esquema de separación, esquema de reemplazo, elección. (Enunciado completo en `a-origins/02-set-theory/01-axiomatic-set-theory-zfc`.)

## Notación de referencia

`⊢` (derivabilidad sintáctica) · `⊨` (satisfacción semántica) · `A ⊢ φ` (φ es teorema de A) · `M ⊨ A` (M modela A) · `A \ {φ}` (A sin el axioma φ).

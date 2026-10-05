# STATUS — estado vivo del repositorio

> **Este es el archivo que responde "¿en qué vamos, dónde trabajo?".**
> No duplica contenido: solo estado y punteros.
>
> Última actualización: **2026-07-27**

---

## En una línea

La aplicación web está construida y funcionando (Milestone 1). El motor matemático resuelve aritmética exacta y ecuaciones polinómicas con pasos, lo que devuelve viene verificado, y cinco de sus reglas llevan detrás una demostración en Lean.

---

## Motor matemático (`engine/`)

**Etapas E0, E1 y E2 — ✅ Completadas.**
**Etapa E3 — Cálculo diferencial. ⬜ Sin empezar.**

El motor resuelve ecuaciones con pasos y sella lo que devuelve: entra
`x^{2}-5x+6 = 0` y salen `\left\{x = 2, x = 3\right\}` con cuatro pasos y
`verificado · nivel 1`.

Estado, métricas y siguiente paso concreto → [`../engine/context/STATUS.md`](../engine/context/STATUS.md)

La capa de TypeScript del motor vive en `src/lib/engine/` (worker, tipos y
`represent/`), y su página en `/motor` — pública, con el árbol de capacidades y
fuera del sitemap, igual que `/visual-identity`.

**El motor no se usa sólo desde el laboratorio:** un bloque `$$…$$` del editor
de notas es un cuaderno donde cada línea se resuelve por su cuenta
(`src/components/artifacts/MathRunner.tsx`, gemelo de `CodeRunner`).

**Un entero no vuelve solo:** el documento del motor trae sus hechos —signo,
paridad, primalidad, factorización, divisores— y `/motor` los pinta
(`src/components/engine-tree/FactList.tsx`). Y un número se puede escribir de más
de una forma: decimales, porcentajes, periódicos, otras bases y redondeo con
nombre, en los dos sentidos.

**Y desde E2, álgebra:** expandir, factorizar y MCD como consultas con nombre, y
ecuaciones lineales y polinómicas resueltas factorizando sobre ℚ. Lo que no
factoriza —o cuyas raíces son irracionales— **lo dice**, en vez de devolver la
pregunta.

**Lean está dentro.** `engine/lean/` compila contra Mathlib y cinco reglas
racionales llevan detrás un teorema demostrado; el nombre viaja hasta el
documento de salida. Se corre con `pnpm engine:lean`, aparte de las puertas,
porque nunca bloquea una etapa.

---

## Aplicación web (`src/`)

**Milestone 1 construido:** identidad visual dirigida por tokens, laboratorio `/visual-identity`, fondos físicos, primer tema y artefactos.

Todo commiteado, incluidos el editor de notas (`src/components/notes/NotesApp.tsx`,
con modelo de bloques recursivo), `src/components/artifacts/CodeRunner.tsx` y
`src/components/GlassRandomizer.astro`.

Arquitectura: [`PLATFORM-ARCHITECTURE.md`](PLATFORM-ARCHITECTURE.md).

---

## Contenido matemático (`media/maths/`)

Árbol de temas definido en [`../media/maths/tree.md`](../media/maths/tree.md): `a-origins`, `b-pure`, `c-applied`.

Framework de 3 niveles (Dato → Información → Conocimiento) definido en [`../media/maths/CONTENT-FRAMEWORK.md`](../media/maths/CONTENT-FRAMEWORK.md). **No aplicado retroactivamente** a los 58 `main.md` placeholder ya creados: el scaffold de 3 archivos se crea tema por tema cuando le llega el turno de escribir contenido real.

**`media/maths/` ES la fuente publicada.** Desde 2026-07-27, un tema con `draft: false` en su
`main.md` se convierte en páginas: `/descubre/<tema>` (Conocimiento), `/informacion`, `/dato`, y
una página propia por átomo. Los tres niveles se renderizan con el mismo modelo de bloques del
editor de Anotaciones, así que la página publicada y la nota editable son el mismo objeto.
Publicar es opt-in: `draft` vale `true` si nadie dice lo contrario, y hoy sólo
`a-origins/00-axioms` está publicado.

**Trabajo en curso** → [`PLAN-TOPIC-PAGES.md`](PLAN-TOPIC-PAGES.md): fases 0–2 cerradas
(formato, renderer, rutas); siguiente el panel *peek* y los cuatro artefactos.

---

## Cómo actualizar este archivo

Al cerrar un milestone: cambiar el estado del área que corresponda. **El estado del motor no se escribe aquí** — vive en [`../engine/context/STATUS.md`](../engine/context/STATUS.md) y aquí solo se apunta.

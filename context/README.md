# MathSlice — punto de entrada

> Si llegas sin contexto (persona o agente), empieza aquí. Este archivo **enruta, no explica**: el contenido vive una sola vez, en el documento que le corresponde.
>
> **¿En qué se está trabajando ahora?** → [`STATUS.md`](STATUS.md)
> **¿Y en el motor?** → [`../engine/context/STATUS.md`](../engine/context/STATUS.md)
> **¿El plan de las páginas de tema?** → [`PLAN-TOPIC-PAGES.md`](PLAN-TOPIC-PAGES.md)

---

## Qué es MathSlice

Plataforma de contenido matemático interactivo: Astro + islas React, autoría en MDX, artefactos incrustables (gráficas, ejecutores de código, diagramas, LaTeX).

En paralelo se construye **un motor de cómputo simbólico propio** en Rust/WASM — solo la capa matemática —, cuyo objetivo primario son los **pasos pedagógicos**.

---

## Mapa del repositorio

| Ruta | Qué es | Doc de referencia |
|---|---|---|
| `src/` | La aplicación Astro + React | [`PLATFORM-ARCHITECTURE.md`](PLATFORM-ARCHITECTURE.md) |
| `media/maths/` | El **contenido** matemático: árbol de temas y su redacción | [`../media/maths/CONTENT-FRAMEWORK.md`](../media/maths/CONTENT-FRAMEWORK.md) |
| `engine/` | El **motor** de cómputo simbólico (Rust/WASM), agnóstico de MathSlice | [`../engine/architecture/README.md`](../engine/architecture/README.md) |
| `context/` | Estás aquí: enrutamiento y estado del repo | [`STATUS.md`](STATUS.md) |
| `context/PLAN-TOPIC-PAGES.md` | El **plan vivo** de las páginas de tema por niveles: qué está hecho, qué sigue | [`PLAN-TOPIC-PAGES.md`](PLAN-TOPIC-PAGES.md) |
| `context/core/` | Cómo se trabaja aquí: principios de organización, comunicación y herramientas. **Fuente única** — `.claude/CLAUDE.md` los importa | [`core/`](core/) |
| `public/`, `dist/` | Estáticos y build | — |

---

## Antes de nada, si eres un agente

`.claude/CLAUDE.md` importa [`core/ORGANIZATION.md`](core/ORGANIZATION.md), [`core/COMMUNICATION.md`](core/COMMUNICATION.md) y [`core/OPTIMAL.md`](core/OPTIMAL.md) — ya los tienes cargados en cada sesión. Si vas a editarlos, edítalos **ahí**: son la fuente única, no se copian a ningún otro sitio.

---

## Según a qué vengas

### …a trabajar en la aplicación web

Lee [`PLATFORM-ARCHITECTURE.md`](PLATFORM-ARCHITECTURE.md). Cubre la decisión Astro + islas React, el modo de autoría en MDX, el catálogo de artefactos, rendimiento, seguridad y renderizado avanzado.

Puntos de entrada útiles en el código:

- `src/lib/graphEngine.ts` — el switch de motor de gráficas (Desmos ↔ Mafs). Una sola constante.
- `src/lib/pyRunner.ts` — Pyodide en un Worker. **Es el patrón que replica el worker del motor.**
- `src/lib/engine/` — la capa de TypeScript del motor: `runner.ts` (cliente), `worker.ts`, `types.ts` (espejo del contrato de Rust) y `represent/`. El WASM compilado va a `src/lib/engine/pkg/`, ignorado en git y regenerado con `pnpm engine:build`.
- `src/lib/codeRunner.ts` — sandbox de ejecución de código de usuario.
- `src/components/artifacts/` — los artefactos incrustables.
- `src/components/notes/` — el editor de notas.

### …a escribir contenido matemático

Lee [`../media/maths/CONTENT-FRAMEWORK.md`](../media/maths/CONTENT-FRAMEWORK.md): todo tema hoja se escribe en 3 niveles — **Dato → Información → Conocimiento** (`00-data.md`, `01-info.md`, `02-know.md`), inspirados en los niveles de un sistema de cómputo.

El mapa de temas está en [`../media/maths/tree.md`](../media/maths/tree.md): `a-origins` (fundamentos), `b-pure` (matemática pura), `c-applied` (aplicada).

### …a trabajar en el motor matemático

Lee [`../engine/architecture/README.md`](../engine/architecture/README.md) y sigue el orden 00→05 que indica.

**¿En qué etapa va el motor?** → [`../engine/context/STATUS.md`](../engine/context/STATUS.md). Es lo primero que debe leer cualquier agente que llegue a `engine/`.

Atajo si vas a escribir código Rust hoy: [`../engine/architecture/01-rust-principles.md`](../engine/architecture/01-rust-principles.md). Son 11 principios con **consecuencias obligatorias**, no recomendaciones.

El inventario de lo que hay que cubrir (1709 capacidades) está en [`../engine/docs/main.md`](../engine/docs/main.md).

---

## Las dos cosas que más se malentienden

**1. El motor no dibuja.** Emite hechos matemáticos (`domain`, `roots`, `singularities`, `asymptotes`); una capa de TypeScript los convierte en gráfica, tabla, diagrama o escena de video. Ningún crate de Rust menciona Desmos, y hay un test en CI que lo verifica.
→ [`../engine/architecture/02-architecture.md`](../engine/architecture/02-architecture.md) §1

**2. La entrada del motor es LaTeX y solo LaTeX.** Nada de `∫`, `√` ni unicode matemático en el parser: esos glifos los dibuja la interfaz.
→ [`../engine/architecture/02-architecture.md`](../engine/architecture/02-architecture.md) §2, crate `ms-parse`

---

## Toolchain

```sh
pnpm dev          # servidor de desarrollo Astro
pnpm build        # build de producción
pnpm check        # astro check (TypeScript)

pnpm engine:build # compila el motor a WASM (wasm-pack) hacia src/lib/engine/pkg/
pnpm engine:test  # cargo nextest sobre el workspace del motor
pnpm engine:gates # clippy + cargo-deny + test de frontera
pnpm engine:bench # línea base del matcher (criterion)
pnpm engine:size  # twiggy sobre el .wasm, contra el presupuesto de 3 MB
pnpm engine:browser # el corpus contra el worker y el WASM reales, en Chrome headless
```

`engine:browser` necesita un `pnpm dev` levantado. Es lo único que comprueba lo
que recibe el estudiante y no lo que compila el host → [`../engine/architecture/05-testing.md`](../engine/architecture/05-testing.md) §10.

El motor se mira en `/motor`: el árbol de capacidades con su cobertura y los casos que se ejecutan ahí mismo. Sustituyó a `/engine-lab`, que era una caja de texto sin más contexto.

`pnpm` es el gestor de paquetes de este repo.

Para el motor: `cargo`, `wasm-pack`, `cargo-nextest`, `cargo-deny` y `twiggy`, todos instalados. La lista completa de herramientas preferidas está en [`core/OPTIMAL.md`](core/OPTIMAL.md).

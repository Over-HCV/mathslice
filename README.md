# MathSlice

Plataforma de contenido matemático interactivo: temas escritos en Markdown/MDX,
artefactos incrustables (gráficas, diagramas, LaTeX, código ejecutable) y un motor
simbólico propio que muestra **los pasos**, no solo el resultado.

- **Web:** Astro + islas React, Tailwind, KaTeX. Español por defecto, inglés en `/en`.
- **Motor:** [`mathslice-engine`](https://github.com/Over-HCV/mathslice-engine), Rust
  compilado a WASM, incluido aquí como submódulo en `engine/`.

## Desarrollo

```sh
git clone --recursive https://github.com/Over-HCV/mathslice
cd mathslice
pnpm install
pnpm engine:build   # compila el motor a WASM (necesita Rust + wasm-pack)
pnpm dev
```

Si ya clonaste sin `--recursive`: `git submodule update --init`.

| Comando | Qué hace |
|---|---|
| `pnpm test` | Tests unitarios (Vitest) |
| `pnpm build` | Build estático en `dist/` |
| `pnpm test:build` | Comprueba lo que el build produjo — correr tras `pnpm build` |
| `pnpm check` | Typecheck de Astro |
| `pnpm engine:test` | Tests del motor |

## Mapa

| Ruta | Qué es |
|---|---|
| `src/` | La aplicación Astro + React |
| `media/maths/` | El contenido matemático: árbol de temas y su redacción |
| `engine/` | El motor (submódulo) |
| `context/` | Documentación del proyecto: estado, planes y arquitectura — empieza por [`context/README.md`](context/README.md) |

## Licencia

Repositorio *source-available*, **no comercial**:

- **Código:** PolyForm Noncommercial 1.0.0 — ver [`LICENSE`](LICENSE).
- **Contenido matemático** (`media/maths/`): CC BY-NC-SA 4.0 — ver [`media/maths/LICENSE`](media/maths/LICENSE).
- **El motor** (`engine/`) es un repositorio aparte bajo licencia MIT, que sí permite uso comercial.

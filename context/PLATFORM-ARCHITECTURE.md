# Arquitectura de plataforma: entorno multimedia interactivo

Complementa a [`media/maths/CONTENT-FRAMEWORK.md`](../media/maths/CONTENT-FRAMEWORK.md) (cómo se estructura el contenido de un tema). Este cubre cómo se **construye y renderiza** la experiencia interactiva.

## 1. Visión de producto

MathSlice es la siguiente evolución de plataforma en educación matemática: un entorno donde el texto es un bloque más entre muchos tipos de bloque, y cada tema del roadmap (`media/maths/`) se explica con artefactos que la persona puede ejecutar, tocar y validar, no solo leer. Notion es una referencia de producto — pero solo en UX y en rendimiento a gran escala (miles de bloques, minimalismo). No es referencia en features de colaboración/workspace/equipos — eso está fuera de alcance por ahora.

Hay una dimensión adicional que no es solo "consumir contenido propio": la plataforma tiene sistema de usuarios, y cada persona podrá tener y crear sus propias explicaciones, no solo leer las nuestras. Esto es lo que motiva usar Supabase Storage para video (§4, §8) y matiza para qué sirve de verdad el futuro editor v2 (§9): no es solo para que colaboradores internos sin conocimientos técnicos editen archivos — es una feature de usuario final.

## 2. Decisión de framework: Astro + islas React

El framework no se elige por moda ni por comodidad — se eligió razonando tres alternativas reales y descartándolas con motivo:

| Opción | A favor | En contra | Veredicto |
|---|---|---|---|
| **SolidJS** (+ SolidStart) | Reactividad granular, sin virtual DOM, muy rápido en el papel | Ecosistema inmaduro para lo que este proyecto necesita en concreto: no hay equivalente maduro a un editor de bloques, react-three-fiber, ni Radix | Descartado — se pagaría el costo de reconstruir a mano lo que en otros ecosistemas ya existe probado |
| **Vue + Nuxt** | Tiptap (base de cualquier editor de bloques) nació en Vue, bindings de primera clase; TresJS es un equivalente maduro a react-three-fiber | Obliga a reescribir desde cero todo lo que ya funciona en `trash/` (Supabase, sandbox de código, shadcn-ui) sin resolver nada que React no resuelva igual de bien aquí | Descartado — el costo de reescritura no se paga con ninguna ventaja real |
| **React puro** (Next.js o SPA en Vite) | Reusa `trash/` casi tal cual, ecosistema más maduro para lo que hace falta (3D, editores) | El rendimiento a "escala Notion" (miles de bloques) depende 100% de que la virtualización y el montaje perezoso de widgets pesados se implementen bien a mano — nada lo da gratis | Viable pero subóptimo frente a la siguiente opción |
| **Astro + islas** | Renderiza casi todo a HTML estático (cero JS por bloque, por defecto), hidrata solo el widget puntual que necesita interactividad; admite componentes React/Vue/Svelte/Solid simultáneamente — no ata el proyecto a un solo framework de UI; Content Collections lee carpetas de Markdown/MDX con frontmatter tipado, encaje directo con `media/maths/<tema>/{main,00-data,01-info,02-know}.md` tal como ya existe | Curva de aprendizaje del modelo de islas; la superficie de autoría/edición sigue siendo una app JS normal | **Elegido** |

**Dato que resuelve el dilema de fondo**: Notion, la referencia de producto que motivó esta pregunta, está construido en React. "Rendimiento altísimo con miles de bloques" no lo da el framework — lo da la arquitectura (virtualización + montar los widgets pesados solo cuando entran en pantalla). Astro no gana porque React sea lento; gana porque convierte ese patrón de arquitectura en una primitiva nativa (`client:visible`, `client:idle`, `client:load`) en vez de algo que hay que construir e mantener a mano con `IntersectionObserver`.

Dentro de Astro, los widgets interactivos (islas) se escriben en **React** — no porque el proyecto esté atado a React, sino porque ahí es donde vive el ecosistema maduro que este catálogo necesita (react-three-fiber, Transformers.js, y el sandbox de código ya construido en `trash/lib/codeRunner.ts`). Astro no impide usar otro framework para una isla puntual si en el futuro conviene.

## 3. Modo de autoría: MDX escrito a mano (por ahora)

El contenido ya se está escribiendo directamente en archivos `.md` por tema (ver `a-origins/00-axioms/*.md` como caso de referencia). En vez de construir primero un editor visual de bloques (BlockNote/Plate — ingeniería seria antes de poder publicar el primer tema con artefactos), se autora en **MDX**: los mismos archivos de siempre, con artefactos incrustados como componentes:

```mdx
## El postulado de las paralelas

Durante 2000 años se intentó demostrar el 5º postulado de Euclides a partir
de los otros 4. La prueba llegó al revés: construyendo un modelo que lo
niega.

<ThreeScene preset="hyperbolic-plane" client:visible />

Cambiar un solo axioma no da una versión "rota" de la geometría — da una
geometría distinta, igual de consistente.
```

Astro renderiza esto directo — el texto es HTML estático, `<ThreeScene>` es la única parte que hidrata JS, y solo cuando entra en viewport (`client:visible`).

El editor visual tipo Notion (arrastrar bloques, sin tocar archivos) queda documentado como **v2**, para cuando haga falta autoría no técnica — incluyendo la de usuarios finales creando sus propias explicaciones (ver §1). No se construye ahora — construirlo antes de tener contenido publicado sería invertir en la pieza equivocada primero. Ver §9 para la técnica de renderizado que debería usar cuando se construya.

## 4. Catálogo de artefactos

| Bloque | Tecnología | Dónde ejecuta | Notas |
|---|---|---|---|
| Texto / Markdown | MDX nativo de Astro | estático (SSG) | bloque base, cero JS |
| LaTeX (mostrar) | KaTeX | estático (KaTeX renderiza a HTML/MathML en build) | reusar tal cual de `trash/`. `react-katex` se quitó: `KatexMath.tsx` llama a `renderToString` directamente, y katex queda **fijado a ^0.16.x** porque `rehype-katex`, `remark-math` y `mafs` dependen de esa línea — subirlo rompe la maquetación en silencio, no el build |
| LaTeX (escribir) | **MathLive** (`<math-field>`) | isla `client:only`, cargada con `import()` al abrir el primer bloque de ecuación | Julio 2026. Es un custom element, y aquí sí encaja donde PyScript no: **vive dentro de un bloque y no posee la página** — nada suyo sale de su subárbol, la isla ya era `client:only` y el markdown del bloque sigue siendo la fuente de verdad. Se configura contra la superficie real del motor (`src/lib/engine/surface.ts`): sin su teclado, sin sus atajos y sin su CAS —`@cortex-js/compute-engine`, 30 MB, que no entra en el bundle porque MathLive lo busca en un global que nadie define—. El `.wasm` de MathSlice es quien calcula |
| Código ejecutable JS/TS | Extender `lib/codeRunner.ts` (iframe `sandbox="allow-scripts"` sin `allow-same-origin` + Worker) | isla `client:visible`, aislada | patrón ya validado — ver memoria `project-mathslice-code-sandbox`, no reinventar ni relajar el sandbox |
| Código ejecutable Python/numérico | Pyodide (CPython a WASM) en Worker | isla `client:visible`, aislada | para sympy/numpy en temas de cálculo/análisis numérico. Verificado julio 2026: Pyodide sigue siendo el motor correcto — PyScript (Anaconda, última release estable 2026.2.1) es solo una capa HTML/templating *sobre* Pyodide, no un sustituto; su modelo de custom elements que "posee la página" no encaja como isla embebida dentro de nuestra arquitectura de sandbox. Se descarta explícitamente, se mantiene Pyodide directo dentro del Worker ya elegido |
| Demostración LEAN | `<iframe>` a playground externo (`live.lean-lang.org` u homólogo), snippet vía query param/postMessage | embed externo | self-host de un servidor Lean propio queda para más adelante — ver §8 |
| Plot Desmos | Desmos API (embed oficial, API key gratuita) | embed externo | "una plot hecha con Desmos", tal cual se pidió |
| Calculadora / graficador propio | **Mafs** (librería React para gráficos matemáticos interactivos: funciones, puntos arrastrables, vectores) | isla `client:visible` | reemplaza `GraphBlock` actual (Recharts — herramienta de gráficos de negocio, no de funciones matemáticas) |
| Escena 3D | react-three-fiber + drei | isla `client:visible` | declarativo, encaja bien como isla |
| Diagramas de nodos (categorías/autómatas/grafos) | react-flow (`@xyflow/react`) | isla `client:visible` | **confirmado** — natural para `a-origins/03-category-theory` y `04-theory-of-computation` |
| Simulación dinámica (sistemas dinámicos, caos) | Canvas/WebGL a medida | isla `client:visible` | motor numérico simple in-browser, sin backend |
| Explicación generada por IA | **Transformers.js + Gemma vía WebGPU** | isla `client:idle` (descarga pesada, no bloquear el render), 100% navegador | sin backend, sin API key; requiere aviso/fallback si el navegador no soporta WebGPU; el modelo se cachea tras la primera descarga |
| Video | `<video>` nativo | estático + streaming | fuente: `media/animations/projects/<slug>/output/final/<lang>/*.mp4`; hosting: **Supabase Storage** (decidido, ver §8 — motivo: multi-tenant, cada usuario puede crear sus propias explicaciones) |
| Imagen con zoom | image viewer con pan/zoom | isla `client:visible` | para diagramas/capturas de Manim |

## 5. Rendimiento: dos problemas distintos

1. **Miles de páginas en la biblioteca de temas** (el árbol completo de `media/maths/`, cientos/miles de hojas a futuro): Astro genera cada página como HTML estático en build (o server-rendered bajo demanda) — no hay "una SPA con miles de items en memoria" que virtualizar a mano. El costo de navegar la biblioteca es el de cargar una página HTML normal, no el de un árbol de estado de cliente creciendo sin límite.
2. **Bloques pesados dentro de una página** (un canvas Three.js, un iframe LEAN, un modelo WebGPU): hidratación perezosa nativa de Astro (`client:visible` = solo monta cuando entra en viewport, `client:idle` = solo cuando el hilo principal está libre). Esto es lo que de verdad evita que "muchos bloques" tumben el rendimiento — un tema individual (según el árbol `a-origins`/`b-pure`) nunca tiene miles de bloques de texto; el riesgo real son pocos bloques *pesados* montados a la vez sin este patrón, y Astro lo resuelve de fábrica en vez de requerir `IntersectionObserver` artesanal.

## 6. Seguridad

El límite de confianza ya validado (`codeRunner.ts`: iframe de origen opaco + Worker, sin `allow-same-origin`, timeout 2s) se reutiliza para todo bloque que ejecute código no confiable/autorado por el usuario (JS, Python vía Pyodide). Los bloques curados (Mafs, react-three-fiber, react-flow) son componentes de primera parte que no ejecutan código arbitrario — corren como cualquier isla normal, sin necesitar ese sandbox.

## 7. Qué pasa con `trash/`

- **Se deja quieto por ahora**: no se toca ni se borra todavía — se elimina cuando la plataforma nueva esté realmente construida y lo reemplace. Sirve de inspiración puntual, pero la interfaz es demasiado genérica y hay que modernizarla aplicando mejores principios de diseño visual (no hay un skill específico para diseño de producto/UI general disponible ahora mismo — queda como trabajo de diseño propio pendiente cuando se retome, no algo automático).
- **Reusar tal cual**: `lib/codeRunner.ts` (sandbox), `integrations/supabase/*`, dependencias KaTeX/`react-katex`, primitivas shadcn-ui/Radix/Tailwind ya instaladas.
- **Eliminar**: la página/sección `Library` y toda la premisa original (README de Lovable) de que la gente compre o suba libros de terceros para que una IA los procese — alojar libros sin derechos de autor es ilegal. El contenido de la plataforma es el roadmap propio de `media/maths/`, no una biblioteca de terceros.
- **Reemplazar**: el sistema de composición de páginas actual (`TextBlock`/`CodeBlock`/`GraphBlock`/`LatexBlock` ad-hoc en una SPA) por Astro Content Collections + MDX + islas; `GraphBlock` (Recharts) se retira en favor de Mafs/Desmos.
- **Secciones/navegación del sitio**: la estructura heredada (`Home`/`Discover`/`Learn`/`Community`/`FAQ`) se confirma como buena — no se rediseña desde cero. El único cambio es quitar `Library`, por el motivo legal de arriba.
- **Renombrar** `trash/` a algo que no invite a borrarlo por error (ej. `app/`) — sugerido, no ejecutado todavía.

## 8. Decisiones adicionales

- **Hosting de video**: **Supabase Storage** — decisión tomada, no queda abierta. Motivo: hay sistema de usuarios y cada persona podrá tener y crear sus propias explicaciones (§1), así que el almacenamiento tiene que ser multi-tenant desde el inicio, no un CDN estático de un catálogo curado único.
- **Self-host de LEAN**: sigue siendo embed externo por ahora (§4). Si en algún punto hace falta backend propio, la opción elegida de antemano es **Google Cloud Run** — no se construye nada todavía.
- **Fallback del bloque de IA sin WebGPU**: mensaje simple — "esto todavía no está disponible en tu navegador". Sin fallback funcional alterno (CPU/WASM) por ahora.
- **Diagramas de nodos**: confirmado, ver fila `react-flow` en §4.

## 9. Renderizado avanzado: dos técnicas distintas, no una

Hay dos técnicas reales y complementarias detrás de "texto/HTML compuesto con canvas" — se documentan por separado porque resuelven problemas distintos y tienen madurez muy distinta.

### 9.1 HTML-in-Canvas (API de Chrome, experimental)

[`developer.chrome.com/blog/html-in-canvas-origin-trial`](https://developer.chrome.com/blog/html-in-canvas-origin-trial) (verificado leyendo el post): es una API nueva que permite **componer elementos DOM reales directamente dentro de un `<canvas>` 2D o de una textura WebGL/WebGPU**, sin renunciar a lo que da el DOM — texto con layout nativo, controles de formulario, selección de texto, copiar/pegar, accesibilidad, Ctrl+F. Mecánica: se marca el `<canvas>` con el atributo `layoutsubtree` (esto expone su contenido anidado al árbol de accesibilidad y lo prepara para mostrarse dentro del canvas), y luego se compone con `drawElementImage(element, x, y)` (Canvas 2D), `texElementImage2D(...)` (WebGL) o `copyElementImageToTexture()` (WebGPU).

**Estado real — no construir sobre esto todavía**: es un *origin trial*, Chrome Canary 148-150, detrás del flag `chrome://flags/#canvas-draw-element`, y la propia documentación de Chrome advierte que "los detalles de implementación pueden cambiar". No hay soporte en Firefox/Safari ni fecha de estandarización. Se documenta como **técnica a vigilar**, no como dependencia de nada que se construya ahora.

**Por qué igual importa para este proyecto (más allá del editor v2)**: si algún día madura, es exactamente lo que hace falta para componer HTML real (una etiqueta LaTeX vía KaTeX, un caption accesible) directamente sobre una textura WebGL/WebGPU — útil para las escenas 3D de react-three-fiber y las simulaciones del catálogo (§4), no solo para el editor. Hasta que exista soporte real, la técnica *actual* para eso sigue siendo la estándar: overlay de HTML posicionado absolutamente encima del canvas (ej. el componente `<Html>` de `@react-three/drei`), que ya es lo que se usaría en los bloques de escena 3D.

### 9.2 Medición de texto sin reflow (`pretext`), para el editor v2

Distinto problema: cuando se construya el editor visual tipo Notion (§3, v2, diferido), el comando `/` para crear columnas dinámicas necesita que el texto se reacomode en tiempo real (arrastrar para redimensionar una columna) sin lag. El cuello de botella ahí es que medir texto vía `getBoundingClientRect`/`offsetHeight` fuerza un *reflow* del navegador — una de las operaciones más caras que existen — y un layout dinámico dispara esa medición constantemente mientras se arrastra.

[`chenglou/pretext`](https://github.com/chenglou/pretext) (verificado leyendo el repo) resuelve esto sin depender de ninguna API experimental: usa el motor de texto del Canvas 2D (API estable, disponible hoy en todos los navegadores) solo para *medir* — ancho de palabras/segmentos, cacheado — separando una fase de análisis cara pero única (`prepare()`) de una fase de layout barata y repetible (`layout()`) que se recalcula por aritmética pura, sin tocar el DOM. El texto se sigue mostrando como texto normal (DOM/HTML); solo el cálculo de dónde rompe línea se hace sin reflow.

Aplica exclusivamente a la **superficie de edición** (v2) — es la técnica que sí se puede adoptar ahora si/cuando se construya ese editor. Las páginas de lectura ya son HTML estático generado por Astro (§2), no tienen columnas redimensionándose en vivo, así que no sufren este problema.

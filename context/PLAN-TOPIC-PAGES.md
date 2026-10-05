# PLAN — Páginas educativas por niveles (Anotaciones como sitio)

> **Este es el plan vivo de la línea de trabajo "páginas de tema".** Si llegas a este
> trabajo sin contexto (persona o agente): lee primero *Dónde vamos* aquí abajo, luego el
> plan completo, y sigue por la primera tarea sin marcar.
>
> Última actualización: **2026-07-27**
> Rama: `MS1-Engine-E3`

---

## Dónde vamos

Las fases 0, 1, 2 y 3 están cerradas y verificadas. Una página de tema **ya es una anotación**:
sale del mismo `.md` que abre el editor, se renderiza con la misma tabla de dispatch, y
existe en las dos locales. Y ya se puede **bajar sin irse**: un embed abre un panel apilable
que pinta el documento con el mismo host React que usa el editor.

| Fase | Tareas | Estado |
|---|---|---|
| 0 — formato y modelo | 1, 2, 3 | ✅ |
| 1 — separación del renderer | 4, 5 | ✅ |
| 2 — pipeline de contenido | 6, 7 | ✅ |
| 3 — peek | 8, 9 | ✅ |
| 4 — artefactos | 10, 11, 12, 13 | ⬜ **siguiente** |
| 5 — contenido | 14, 15 | ⬜ |
| 6 — verificación | 16 | 🔄 crece con cada fase |

### Qué existe hoy

```
src/lib/notes/
  model.ts        modelo de bloques (era src/lib/notes.ts). Contenedores generalizados:
                  childListsOf / withChildLists son el ÚNICO sitio que sabe qué es un contenedor
  directives.ts   gramática de atributos, ::embed, <Atom ref>, fences de artefacto
  format.ts       parseNote / serializeNote — el round-trip verbatim. NUNCA lanza
  render.ts       renderKindOf — LA tabla de dispatch. Pura, sin JSX
  markdown.ts     un solo pipeline remark/rehype + remarkAtomRef (escrito a mano, cero deps nuevas)
  slug.ts         anclas con el algoritmo exacto de GitHub
  refs.ts         gramática de refs + las URLs que producen
  loadTopics.ts   una pasada sobre media/maths → manifests, topics, atoms
  validate.ts     todo lo que debe ser cierto del árbol de contenido. Fatal, con file:line

  refs.ts         gramática de refs, las URLs que producen (página y peek) y resolveRefIn

src/lib/
  topicRoutes.ts  enumerador puro de rutas (testeable sin Astro)
  topicPages.ts   el único sitio que toca astro:content. Memoiza en PROD
  peek.ts         PeekDoc + projectPeek + las decisiones puras del panel + el bus por CustomEvent

src/components/notes/render/
  pieces.tsx      el markup de un bloque, sin host. Cero JS
  BlockView.tsx   host React: modo lectura del editor Y el peek

src/components/topic/
  BlockRenderer.astro  host Astro: decide qué hidrata, recursivo
  TopicView.astro      la página de tema; monta <PeekHost client:idle>
  PeekHost.tsx         portal, delegación, fetch, historial, Escape, foco, lock
  PeekPanel.tsx        un panel; detrás de React.lazy porque arrastra BlockList

src/pages/descubre/[...slug].astro      shim de 5 líneas
src/pages/en/descubre/[...slug].astro   shim de 5 líneas  ← arregla el enlace muerto histórico
src/pages/peek/[...slug].json.ts        el documento que pinta el panel
src/pages/en/peek/[...slug].json.ts     su gemelo

scripts/dist.smoke.ts   aserciones sobre dist/ (pnpm test:build, tras pnpm build)
```

### Decisiones tomadas al implementar, que se desvían del plan de abajo

1. **Un solo tipo de bloque nuevo, no cuatro.** El plan pedía `AtomBlock`, `EmbedBlock`,
   `AtomRefBlock` y `ArtifactBlock`. Sólo `atom` es un tipo real, porque sólo `atom`
   *contiene* bloques. Embeds, refs y artefactos son bloques `text` cuyo contenido es la
   directiva o el fence verbatim, detectados por forma — la misma decisión que `model.ts`
   ya había tomado al eliminar `latex` y `code` como tipos. Consecuencia: el round-trip de
   un artefacto es exacto por construcción y siguen siendo editables como texto plano.

2. **`group` y `order` se derivan del path, no se declaran.** `a-origins/00-axioms` ya dice
   ambas cosas. `main.md` sólo declara lo que el path no puede saber: `title`, `summary`,
   `draft`.

3. **Cada registro lleva `id` y `ref`.** `id` es la clave de colección y lleva idioma
   (`es/a-origins/00-axioms/sistema-formal`); `ref` es a lo que apunta un ref y no lo lleva
   (`a-origins/00-axioms/sistema-formal`). Sin esto, la traducción de un átomo colisiona con
   el original. La resolución cae al locale por defecto cuando falta la traducción.

4. **El locale por defecto define el conjunto de rutas.** Una traducción añade un
   *renderizado*, nunca una ruta.

5. **`pieces.tsx` existe.** El plan hablaba de dos hosts de una tabla; el markup también
   tenía que ser uno solo, o la tarjeta de un átomo se vería distinta en el sitio y en el
   editor.

6. **El endpoint va en `src/pages/peek/`, no en `_peek/`, y son dos archivos.** Astro descarta
   **en silencio** toda ruta con un segmento que empiece por `_` (`isPublicRoute` en
   `core/util.js`, de la que dependen `isPage` e `isEndpoint`): el diseño original habría
   emitido cero rutas sin un solo error. Y con `prefixDefaultLocale: false` un catch-all cubre
   un locale, así que hay dos shims sobre `topicPaths(locale)`, igual que `descubre`.

7. **Todo cierre del peek pasa por `history.back()`.** Cerrar con `setStack` dejaría huérfanas
   las entradas de historial que abrir empujó: tras tres Escapes harían falta tres Atrás para
   salir de la página. Y el estado guarda **la cadena entera de refs**, no una profundidad,
   porque `popstate` también dispara hacia adelante y una entrada que no guardaste no se
   reconstruye.

8. **`links[ref]` no resolvía un ref con ancla — el ejemplo estrella de este plan estaba
   muerto.** `linkTable()` indexa por `record.ref`, que nunca lleva `#`, así que
   `a-origins/00-axioms/data#sistema-formal` renderizaba `href={undefined}`. Ahora los dos
   hosts pasan por `resolveRefIn` (`refs.ts`), que parsea, busca por `refTargetId` y vuelve a
   pegar el ancla.

9. **`PeekPanel` va detrás de `React.lazy`, y eso no es una optimización.** `BlockView.tsx`
   importa estáticamente `CodeRunner`, `GraphBlock`, `MathRunner` y `NodeDiagram`, así que un
   `PeekHost` que importara `BlockList` bajaría `@xyflow/react` —el pesado del §10.3— a **todas**
   las páginas de tema, abra alguien un peek o no. El host es el oyente y el reducer; el
   renderizador llega con el primer panel.

10. **La franja de un panel inferior no es pulsable.** Los paneles de debajo son `inert`, que es
    lo correcto para teclado y lectores de pantalla, y `inert` también bloquea el puntero. Se
    elige `inert`: bajar un nivel es `‹` y el backdrop cierra la pila.

### Estado de la verificación

- 218 tests de Vitest (`pnpm test`)
- 7 aserciones sobre `dist/` (`pnpm test:build`, después de `pnpm build`). La que importa:
  **cada `data-peek-ref` que la página renderizó, pasado por el `peekUrl()` de producción,
  nombra un archivo que existe.** Se comprobó que falla borrando ese archivo.
- `pnpm check` — 0 errores
- `pnpm build` — 61 páginas, 6 de tema y 6 de peek (3 niveles × 2 locales)
- `pnpm engine:browser` — 112/112 en Chrome real, incluido el caso del editor
- Ley 1 del round-trip sobre el corpus real: los 60 `.md` de `media/maths` van byte a byte
- Peek, comprobado en Chrome: abre y pinta, ancla a la que salta, anida, el guarda de ciclos
  rechaza el mismo documento en otra ancla, la quinta no apila, Escape saca de uno en uno, el
  foco vuelve al disparador, el lock computa `overflow: hidden`, cmd-clic no se intercepta, y
  un ref roto da panel de error con ⤢ vivo. La hoja móvil sólo se verificó a nivel de CSS
  (`@media (width < 40rem)`): la ventana de pruebas no bajaba de 1363px.

### Lo siguiente, en orden

1. **Tareas 10–13** — los cuatro artefactos, paralelizables. Empezar por LeanProof.
2. **Tarea 14** — reescribir los cuatro archivos de `00-axioms`. El MDX borrado (cuya prosa
   cálida hay que rescatar en `02-know.md`) está en git: `git show HEAD:src/content/discover/a-origins/00-axioms.mdx`.
   `02-know.md` se reescribe con la ecuación de Veritasium `V = (M + (Q → A)) × (A + B)`:
   abrir por el malentendido, dejar que genere la pregunta y su respuesta, y trenzar dos hilos
   (historia ⇄ qué significa) saltando de uno a otro cada vez que el que corre se apaga.

### Trampas conocidas, ya pagadas una vez

- Si `pnpm engine:browser` falla con `504 (Outdated Optimize Dep)`, la caché de Vite está
  rancia tras instalar una dependencia: `pnpm exec astro dev stop && rm -rf node_modules/.vite`.
  **Se presenta también como «el bloque no renderizó la ecuación ni abrió el editor»**: MathLive
  se carga con `import()`, y con la caché rancia ese import falla en silencio, así que no monta
  ningún `<math-field>` y el caso del editor cae. Mismo remedio.
- Un servidor de `astro dev` de horas puede servir contenido rancio aunque el archivo esté
  guardado: la colección se cachea en `content.config.ts` y su watcher no siempre despierta.
  Si un `.md` recién editado no aparece en la página, reinicia antes de buscar el bug.
- Un directorio bajo `src/pages/` que empiece por `_` no emite rutas y no avisa. `PEEK_SEGMENT`
  lo documenta y `src/lib/peek.paths.test.ts` comprueba que los dos endpoints siguen existiendo
  donde `peekUrl()` los busca.
- `.glass` fuerza `isolation: isolate` (`global.css`). El peek va por `createPortal`, no es
  negociable — es la misma trampa que empujó a `MathCommandPopover` a un portal.
- El orden del `Escape`: `PeekHost` en **fase de captura** mientras la pila no esté vacía, o
  compite con el Escape-a-seleccionar del editor.

---

# El plan, completo


## Contexto

El sitio tiene un solo tema escrito, `/descubre/a-origins/00-axioms`, como MDX plano
escrito a mano (`src/content/discover/a-origins/00-axioms.mdx`, 93 líneas). Es un remix
aplanado de los tres archivos de investigación que sí existen en
`media/maths/a-origins/00-axioms/` (`00-data.md`, `01-info.md`, `02-know.md`), y pierde
justo lo que los hace valiosos: que son **tres niveles de abstracción complementarios**
(`media/maths/CONTENT-FRAMEWORK.md`).

Lo que falta, y es el objetivo:

1. Que la página publicada **sea una anotación** — el mismo modelo de bloques del editor
   de `Anotaciones`, para que el nivel alto sea cómodo y dinámico de modificar.
2. Que se pueda **bajar de nivel**: Conocimiento (entrada, narrativo) → Información
   (relaciones y grafos) → Dato (átomos formales, referenciables individualmente).
3. Que el descenso sea **recursivo al estilo Notion**: un embed se abre en *peek* apilable
   y además se puede expandir a su propia página.
4. Artefactos más allá del motor de ecuaciones que hagan la explicación mejor.

`src/lib/notes.ts:274-278` ya declara la intención sobre la que se apoya todo esto:
*"Storing everything as markdown means a document round-trips to a plain .md/.mdx on
export."* Este trabajo termina esa frase en vez de construir un sistema paralelo.

Al aterrizar esto, el editor de bloques deja de ser "v2 diferido" y pasa a ser la
superficie de autoría real — hay que actualizar `context/PLATFORM-ARCHITECTURE.md` §3.

**Alcance:** maquinaria genérica para los 58 temas; contenido escrito y verificado
end-to-end solo para `00-axioms`. El siguiente tema debe ser escribir 3 `.md` y nada de código.

---

## Decisiones tomadas

| Fork | Decisión |
|---|---|
| Fuente de verdad | El `.md` en git. Serializador bidireccional `parseNote` ⇄ `serializeNote`. |
| Descenso | Peek apilable **y** ruta propia — el mismo elemento ofrece las dos cosas. |
| Átomos | Directivas `:::atom{…}` dentro de `00-data.md` + índice derivado en build. |
| Artefactos | Los cuatro: AxiomToggle, LeanProof, DerivationStepper, KnowledgeGraph. |

---

## 1. Formato markdown ⇄ NoteDoc

### Principio: el parser nunca re-renderiza prosa

Segmenta el archivo en bloques y guarda **el trozo de fuente literal** de cada uno. La
ausencia de pérdida es por construcción, no por un serializador cuidadoso.

### No instalar `remark-directive`

Se adopta su *gramática* (`:::nombre{attrs}`, más dos puntos = más anidamiento) y se
implementa parse+serialize a mano, ~200 líneas. Razones:

1. Un pipeline remark **no puede** ser lossless: implica `mdast-util-to-markdown`, que
   normaliza énfasis, viñetas, padding de tablas y escapes. Cada guardado reescribiría
   prosa escrita a mano. Incompatible con "legible en un diff".
2. `remark-directive` parsea pero no serializa de vuelta con nuestro orden de atributos.
3. GitHub no soporta directivas: el paquete no compra renderizado.
4. Pesa en el navegador — el editor importa el parser, y esa página ya carga KaTeX,
   MathLive y Mafs.

**No depender de `mdast-util-find-and-replace` transitivamente vía `remark-gfm`** (phantom
dependency). El plugin `remarkAtomRef` recorre nodos de texto a mano, ~40 líneas, cero deps.

### Sintaxis

Dos mecanismos con regla clara:
- **Directivas de dos puntos** envuelven markdown (atom, embed, columns) — el cuerpo debe
  seguir renderizando en GitHub.
- **Fences** envuelven datos opacos (params de artefactos, mafs, diagram) — CommonMark
  trata el cuerpo como opaco, así que nada de dentro puede romper el documento.

````markdown
---
title: "Dato — Axiomas"
level: data
lang: es
---

## Definiciones formales          ← heading (verbatim, se conservan los #)

Un axioma es …                    ← text (markdown verbatim)

$$
A \vdash \varphi \\ M \models A
$$                                ← text; detectMath() ya lo maneja

```mafs
y=\sin(x)
```
```diagram
{ "nodes": [...], "edges": [...] }
```
```axiom-toggle
{ "system": "euclid", "axioms": [...] }
```
```lean theorem=MathSlice.inverse_unique_sound
theorem inverse_unique_sound … := by …
```

:::atom{id="sistema-formal" kind="definition" needs="fbf,regla-inferencia"}
**Sistema formal.** Una tupla $(L, A, R)$ donde …
:::

::embed[Cómo un axioma genera teoremas]{ref="a-origins/00-axioms/info#el-mecanismo"}

::::columns{widths="1,1"}
:::col
Izquierda.
:::
:::col
$$e^{i\pi}+1=0$$
:::
::::

<Atom ref="a-origins/00-axioms/sistema-formal" />                    ← bloque
… la noción de <Atom ref="…/sistema-formal">sistema formal</Atom> … ← inline
````

- **Gramática de atributos cerrada**: solo `key="value"`, comillas obligatorias, sin
  atajos `#id`/`.class`. Parsear es un regex; serializar es exacto.
- **Lenguajes de fence reservados** (interceptados antes de `detectFence`): `mafs`,
  `diagram`, `axiom-toggle`, `derivation`, `knowledge-graph`. `lean` sigue siendo un fence
  normal, solo cambia su *render kind*.
- **`<Atom>` inline usa la forma con etiqueta** `<Atom ref="…">texto</Atom>`: el
  sanitizador de GitHub borra tags desconocidos pero **conserva sus hijos**, así que la
  frase sobrevive. La forma auto-cerrada desaparece en GitHub, por eso se reserva para uso
  a nivel de bloque (donde la tarjeta se genera del título del propio átomo).

### Los ids se regeneran, nunca se escriben

Hoy son `uid()` aleatorios. Escribirlos convertiría cada bloque insertado en una línea de
diff y haría hostil la edición a mano. Lo que sí necesita identidad estable la tiene por
otra vía: `atom{id=…}` lo escribe el autor, y los headings usan
`src/lib/notes/slug.ts` implementando el algoritmo de slug de GitHub **exacto**, para que
`#el-mecanismo` resuelva igual en GitHub que en el sitio. Los embeds referencian destinos,
no bloques de origen.

Consecuencias a asumir: undo/redo y selección son de sesión (ya lo son), y un futuro
sistema de comentarios anclados obligaría a escribir ids. El test de round-trip compara
**módulo ids**.

### Contrato

```ts
// src/lib/notes/format.ts
export type NoteFrontmatter = { title: string; level?: Level; lang: Locale; [k: string]: unknown };
export type ParsedNote = { frontmatter: NoteFrontmatter; doc: NoteDoc };

export function parseNote(md: string, opts?: { path?: string }): ParsedNote;
export function serializeNote(note: ParsedNote): string;
```

Dos leyes, ambas testeadas:
- **Idempotencia sobre el corpus**: `serializeNote(parseNote(f)) === f` para todo archivo
  versionado. Gate de CI → los archivos en git son siempre canónicos y el editor nunca
  produce un diff espurio.
- **Fidelidad del doc**: `parseNote(serializeNote(doc)).doc ≡ doc` módulo ids.

Único punto con pérdida: **rachas de líneas en blanco entre bloques de primer nivel
colapsan a una**. Se normaliza una vez y se fija con la ley 1.

**Parser que no lanza.** Cualquier trozo no reconocido se convierte en un `text` verbatim.
En el peor caso un constructo se ve como prosa; nunca puede desaparecer.

### Cambio de modelo en `notes.ts`

Cuatro tipos nuevos significan contenedores nuevos. En vez de añadir casos `isColumns` en
ocho helpers, generalizar una vez:

```ts
export type ContainerBlock = ColumnsBlock | AtomBlock;
export function childListsOf(b: Block): Block[][];              // [] en hojas
export function withChildLists(b: Block, lists: Block[][]): Block;
```

`updateBlock`, `removeBlock`, `pathTo`, `insertAfter`, `moveWithinColumn`,
`moveBlockNextTo`, `flattenVisual`, `edgeLeaf` y `countLeaves` pasan por esos dos. ~40
líneas tocadas, y el siguiente contenedor (callout, aside) sale gratis.

```ts
export type AtomBlock     = { id; type: "atom"; atomId: string; kind: AtomKind; needs: string[]; blocks: Block[] };
export type EmbedBlock    = { id; type: "embed"; ref: string; label: string };
export type AtomRefBlock  = { id; type: "atomref"; ref: string; label?: string };
export type ArtifactBlock = { id; type: "artifact"; name: ArtifactName; content: string }; // JSON crudo
```

`ArtifactBlock.content` se queda como **texto JSON crudo**, no objeto parseado: es lo que
hace que el orden de claves y el formato hagan round-trip exacto.

---

## 2. Dónde viven los archivos

**Los tres archivos de nivel bajo `media/maths/` pasan a ser la fuente publicada.** Se
elimina `src/content/discover/a-origins/00-axioms.mdx` y la colección `discover`. Dos
copias divergen, y la decisión es que el `.md` en git sea *la* fuente. El content layer de
Astro 7 acepta una base fuera de `src/`, y `hasContent` en `src/lib/mathsTree.ts` pasa a
ser cierto en vez de significar "existe un MDX".

Coste, dicho claro: `media/maths` también es fuente de investigación para video, así que un
cambio editorial ahí ahora llega a producción. **Guarda: flag `draft` con default `true`**;
`topicRoutes()` salta los borradores. Solo `00-axioms` lo pone en `false` en esta pasada,
así que los 57 `main.md` placeholder no pueden convertirse en páginas por accidente.

### Migración concreta de `00-axioms`

`main.md` pasa a ser **metadatos + índice humano, cuerpo no publicado**:

```yaml
---
title: Axiomas
group: a-origins
order: 0
draft: false
lang: es
summary: >-
  Un axioma es un enunciado aceptado sin demostración, el punto de partida de todo
  sistema matemático. Qué son, por qué cambiar uno no rompe las matemáticas, y cómo
  se prueba que uno es independiente.
videoOutline: [ … los 5 beats que ya están escritos … ]
---
```

Cada archivo de nivel recibe `title`/`level`/`lang` y hereda `group`/`order`/`summary`/`draft`.

- **`00-data.md`** — backticks → LaTeX: `` `A ⊢ φ` `` → `$A \vdash \varphi$`,
  `` `(L, A, R)` `` → `$(L, A, R)$`, `` `M ⊨ A` `` → `$M \models A$`. Las cuatro
  definiciones de §"Definiciones formales" pasan a `:::atom{kind="definition"}`
  (`sistema-formal`, `axioma`, `teorema`, `modelo`); las cuatro propiedades a
  `kind="property"` (`consistencia`, `independencia`, `completitud`, `categoricidad`); las
  instancias canónicas a `kind="axiom"` (`postulados-euclides`, `axiomas-peano`,
  `axiomas-grupo`, `zfc`). El motor no ofrecerá botón de play sobre `\vdash` — es el
  comportamiento diseñado de `probe`, no un bug; dejar un comentario para que nadie lo "arregle".
- **`01-info.md`** — la derivación ASCII de unicidad del inverso pasa a ```` ```derivation ````;
  el diagrama ASCII del sistema formal a ```` ```diagram ````; la sección "cambiar un axioma
  cambia el universo" gana un ```` ```axiom-toggle ```` del sistema de grupo; el párrafo del
  5º postulado gana `::embed{ref="a-origins/00-axioms/know#historia"}`.
- **`02-know.md`** — gana el ```` ```axiom-toggle ```` de Euclides (plano ↔ disco de Poincaré),
  `<Atom>` inline hacia `00-data.md` en cada término formal que menciona de pasada, y
  termina con `::embed` a `info` y `data` — el descenso.

Nota editorial: los `.md` son más densos y correctos que el MDX actual, que es un remix más
amable. **La calidez del MDX pertenece a `02-know.md`** — hay que rescatar esa prosa ahí,
no descartarla.

---

## 3. Rutas

```
/descubre/<group>/<topic>                  → 02-know.md   (entrada)
/descubre/<group>/<topic>/informacion      → 01-info.md
/descubre/<group>/<topic>/dato             → 00-data.md
/descubre/<group>/<topic>/atomo/<atom-id>  → un átomo como página propia
/en/… mismas rutas (los slugs siguen en español, regla ya documentada en src/i18n.ts)
```

`main.md` **no tiene ruta**: su prosa es el `summary`, su índice es la navegación de
niveles que se pinta en cada página de nivel.

```ts
// src/lib/topicRoutes.ts — un solo enumerador para que ambos locales coincidan
export type TopicRoute =
  | { kind: "level"; slug; topic; level: Level; locale: Locale; translated: boolean }
  | { kind: "atom";  slug; topic; atomId: string; locale: Locale; translated: boolean };
export function topicRoutes(locale: Locale): TopicRoute[];
```

- Reescribir `src/pages/descubre/[...slug].astro` como shim de 5 líneas hacia un nuevo
  `src/components/topic/TopicView.astro` (patrón ya establecido: `anotaciones.astro` → `NotesView.astro`).
- **Crear `src/pages/en/descubre/[...slug].astro`** — arregla el enlace muerto actual
  (`mathsTree.ts` genera hrefs `/en/descubre/…` que hoy dan 404).
- Se emiten rutas EN para **todos** los temas. Donde no haya archivo EN, se renderiza el ES
  con banner "todavía sin traducir" y `translated: false`. Una traducción que falta no debe
  producir un 404 desde un enlace que la propia navegación generó.
- `TopicView.astro` pasa `altLocaleHref` a `Base.astro` (la prop ya existe).

---

## 4. Renderer de solo lectura, sin duplicar la tabla de dispatch

`LeafRow` (`src/components/notes/NotesApp.tsx:805-907`) es la tabla de dispatch. Se separa
la **decisión** del **cableado**:

```ts
// src/lib/notes/render.ts — la única tabla. Pura, sin JSX, sin React.
export type RenderKind =
  | { kind: "markdown"; content: string }
  | { kind: "heading"; level: number; text: string; anchor: string }
  | { kind: "math"; lines: string[]; offsets: number[] }
  | { kind: "code"; lang: string; code: string; runnable: "js" | "py" | null }
  | { kind: "lean"; code: string; theorem: string | null }
  | { kind: "mafs"; expr: string }
  | { kind: "diagram"; data: DiagramData }
  | { kind: "artifact"; name: ArtifactName; props: unknown }
  | { kind: "embed"; ref: string; label: string }
  | { kind: "atomref"; ref: string; label?: string }
  | { kind: "columns"; columns: Block[][]; widths: number[] }
  | { kind: "atom"; atomId: string; atomKind: AtomKind; needs: string[]; blocks: Block[] };

export function renderKindOf(block: Block): RenderKind;
```

```ts
// src/lib/notes/markdown.ts — para que ambos hosts rendericen markdown idéntico
export const REMARK_PLUGINS = [remarkGfm, remarkMath, remarkAtomRef];
export const REHYPE_PLUGINS = [rehypeKatex];
```

Dos hosts, una tabla:

| host | archivo | consumidor |
|---|---|---|
| Astro (SSG, zero-JS primero) | `src/components/topic/BlockRenderer.astro` | página publicada |
| React | `src/components/notes/render/BlockView.tsx` | modo lectura del editor **y** el peek |

La rama no-editing de `LeafRow` colapsa a `<LeafView block … onRequestEdit … autoRunKey …/>`.
El host React tiene que existir igual (lo necesita el editor), así que esto son dos hosts de
una tabla, no dos tablas. Dejarlo escrito en la cabecera del archivo para que nadie lo
"deduplique" hasta romperlo.

**Estático vs hidratado:**

| kind | directiva | nota |
|---|---|---|
| markdown, heading, columns, atom | **ninguna** | Astro SSRea el `<Markdown>` de React sin `client:` → HTML estático, cero JS. Es el truco que ya documenta `Latex.tsx`. |
| lean | **ninguna** | `<pre>` + badge + `<a>` al playground |
| code no ejecutable | **ninguna** | `<pre>` estático |
| code ejecutable | `client:visible` | `CodeRunner` |
| math `$$` | `client:visible` | `MathRunner`; su KaTeX prerenderiza en servidor, los botones llegan al hacer scroll |
| mafs, diagram, axiom-toggle, derivation, knowledge-graph | `client:visible` | |
| embed, atomref | **ninguna** | `<a data-peek-ref>` estático — ver §5 |

`PeekHost` es la única isla `client:idle` de la página.

---

## 5. El panel peek

**El disparador es un enlace de verdad.** Cada embed/atomref renderiza en build como:

```html
<a href="/descubre/a-origins/00-axioms/dato#sistema-formal"
   data-peek-ref="a-origins/00-axioms/data#sistema-formal">…</a>
```

Un elemento, las dos afordancias: clic izquierdo → peek (interceptado); cmd/rueda → página
completa (comportamiento por defecto del navegador, intacto); más un botón ⤢ explícito en
la cabecera del panel. Si la isla nunca hidrata, el enlace simplemente navega. Mejora
progresiva; nunca hay UI muerta.

**El estado vive en una isla.** `TopicView.astro` monta `<PeekHost client:idle />` una vez,
con `stack: PeekEntry[]`.

**Las islas hermanas se comunican por eventos DOM delegados**, no por un módulo compartido —
los disparadores son HTML estático de Astro sin JS propio:

```ts
// src/lib/peek.ts
export function openPeek(req: { ref: string; label?: string; trigger?: HTMLElement }): void;
export function onPeekOpen(fn: (r: PeekRequest) => void): () => void;
```

`PeekHost` además engancha **un** listener `click` delegado en `document` para `[data-peek-ref]`.

**El contenido es JSON, no HTML.** Endpoint estático `src/pages/_peek/[...slug].json.ts`
(`getStaticPaths` desde el mismo `topicRoutes()`) sirve el `NoteDoc` serializado; `PeekHost`
lo pide y lo pinta con **`BlockView.tsx`**, el host React de §4. Inyectar HTML dejaría los
artefactos muertos dentro del peek (no hay runtime de Astro para markup inyectado);
renderizar con React hace que un `DerivationStepper` dentro de un peek funcione.

**Glass.** Los paneles son `.glass` — chrome flotante es exactamente lo que documenta
`Glass.astro`. Van por `createPortal(…, document.body)` porque `.glass` fuerza
`isolation: isolate` (`global.css`), la misma trampa que empujó a `MathCommandPopover` a un
portal. El área de lectura *interior* es `bg-surface`, por la regla documentada de que las
superficies de lectura larga van opacas para que las matemáticas se lean.

**Apilado y teclado.** Profundidad `d` desplaza `min(d*24, 96)px` desde el borde izquierdo
del panel anterior. `Escape` saca un nivel, manejado **en fase de captura con
`stopPropagation` mientras la pila no esté vacía** — si no, compite con el Escape-a-
seleccionar del editor (el bail de `MATH-FIELD` en el listener de Cmd+Z es el precedente de
lo fácil que chocan aquí los listeners a nivel de window). Focus trap y `aria-modal` solo en
el panel superior; al cerrar, el foco vuelve al disparador guardado. Profundidad máxima 4;
más allá, navega en vez de apilar.

**Historial.** Cada push hace `history.pushState`; un handler de `popstate` saca. Así el
botón atrás de Android cierra el peek en vez de abandonar la página.

**Móvil (<640px).** El panel es un bottom sheet a `92dvh` con asa de arrastre; apilar pasa a
reemplazar (solo se ve el superior, con `‹` y swipe atrás para volver). Misma máquina de
estados, otra presentación — no una segunda implementación.

---

## 6. Índice de átomos

**Un loader de content collection. Sin archivo generado.** El otro índice del repo
(`engine/tree/*.json`) es un artefacto generado porque su fuente es Rust; aquí la fuente es
el mismo `.md` que el loader de temas ya parsea, así que un archivo generado sería una
segunda fuente de verdad que puede quedarse rancia. El content layer de Astro cachea y
observa, así que `astro dev` recarga ambas colecciones al tocar `00-data.md`.

```ts
// src/content.config.ts
const topics = defineCollection({ loader: topicLoader(), schema: topicSchema });
const atoms  = defineCollection({ loader: atomLoader(),  schema: atomSchema });
// ambos delegan en una sola pasada de parseo: src/lib/notes/loadTopics.ts
```

```ts
export type AtomKind = "definition" | "axiom" | "theorem" | "lemma" | "property" | "notation" | "example";
export type AtomRecord = {
  id: string;        // "a-origins/00-axioms/sistema-formal"
  localId: string; topic: string; level: Level; kind: AtomKind;
  needs: string[];   // resueltos a ids globales
  title: string;     // attr `label`, si no el primer strong/heading del cuerpo
  href: string;      // "/descubre/a-origins/00-axioms/atomo/sistema-formal"
  blocks: Block[]; lang: Locale;
  source: { file: string; line: number };   // para que todo error apunte a un sitio
};
```

**Validación — toda en build, toda fatal, toda nombrando `file:line`:**
- `kind` fuera del conjunto cerrado → throw
- `id` duplicado dentro de un tema → throw
- `needs`, `<Atom ref>` o `::embed{ref}` sin resolver → throw
- ciclo en el DAG de `needs` → throw nombrando el ciclo (protege a `KnowledgeGraph` de un
  layout infinito y a `DerivationStepper` de una cadena de justificación infinita)
- átomo declarado fuera de `00-data.md` → throw

El throw ocurre dentro del loader → `astro build` falla y `astro dev` muestra el overlay. La
misma `validateAtoms(records)` la llama un test de Vitest directamente, así que los fallos
salen en milisegundos en vez de tras un build completo. Una implementación, dos entradas.

**Spike primero (10 min, antes de construir nada encima):** confirmar que el loader `glob()`
de Astro 7 observa una base fuera de `src/` en dev. Si no, loader a mano + `vite.server.watch`
en `astro.config.mjs`.

---

## 7. Los cuatro artefactos

Todo LaTeX pasa por `KatexMath.tsx`, nunca por `katex` directo — si no, la separación
0.16/0.18 que ese archivo documenta vuelve como layout roto en vez de como error de build.

### AxiomToggle — `src/components/artifacts/AxiomToggle.tsx` + `src/lib/artifacts/axiomSystem.ts`

Modelo genérico: axiomas + consecuencias, cada consecuencia declara qué axiomas necesita.
Apagas un axioma → una consecuencia sobrevive sii todos sus `needs` están encendidos. Las
alternativas con nombre cubren el caso del 5º postulado.

```ts
export type AxiomSystem = {
  id: string; title: string;
  axioms: {
    id; label; statement: string;                 // markdown con $…$
    required?: boolean;                            // estructural, no se puede apagar (ej. clausura)
    variants?: { id; label; statement }[];         // negaciones que siguen siendo consistentes
  }[];
  consequences: { id; label; statement; needs: string[]; atom?: string }[];
  models?: { id; label; note; when: Record<string, boolean | string>;
             visual?: { component: "euclidean-plane" | "poincare-disk" | "sphere" | "none" } }[];
};
```

- **Euclides**: 5 axiomas, `p5.variants = [hyperbolic, elliptic]`, `models` mapea
  `{p5:true}` → plano euclidiano y `{p5:"hyperbolic"}` → disco de Poincaré.
- **Grupo**: clausura `required`; asociatividad/identidad/inverso conmutables. Consecuencias:
  unicidad de la identidad, unicidad del inverso, cancelación, `(ab)^{-1}=b^{-1}a^{-1}`.
  Apagar asociatividad apaga unicidad del inverso — la carga pedagógica de `01-info.md`.
- **Peano**: apagar inyectividad de `S` admite un modelo cíclico, expresado como entrada de
  `models` con su `note`.

Datos **escritos inline en el fence** (la fuente sigue siendo la nota, el round-trip es
trivialmente exacto); se admite `{ "ref": "group" }` para reutilizar entre temas.
**No usa el motor**; el visual es SVG pequeño o una escena de Mafs.

### LeanProof — `src/components/artifacts/LeanProof.tsx`

**Sin sintaxis nueva.** Un fence ```` ```lean ```` ya parsea; solo cambia su render kind. La
info-string lleva la afirmación: ```` ```lean theorem=MathSlice.inverse_unique_sound ````.

Chequeo en build: grep de `engine/lean/MathSlice/*.lean` por el nombre del teorema. Ausente →
error de build. Presente → badge "Demostrado en CI (`lake build`)". Sin `theorem=` → badge
"Sin verificar", porque el invariante 3 de `engine/architecture/03-lean-verification.md` dice
que lo no verificado se **marca**, nunca se esconde. El grep es rápido; `pnpm engine:lean`
(Mathlib, minutos) sigue siendo el gate lento.

Para `00-axioms`, añadir `engine/lean/MathSlice/Group.lean` con `inverse_unique_sound` (~8
líneas) para que el badge sea cierto en la primera página que sale y el chequeo quede ejercitado.
**Cero JS**, no usa el motor.

### DerivationStepper — `src/components/artifacts/DerivationStepper.tsx`

```ts
export type DerivationStep = { latex: string; reason: string; invokes: string[] };
type DerivationProps = { system?: AxiomSystem | { ref: string }; goal: string; steps: DerivationStep[] };
```

Fence ```` ```derivation ````; sustituye la derivación ASCII de `01-info.md`. El raíl lateral
de axiomas se resalta según `invokes`.

**Motor: opcional, más adelante.** El motor no hace teoría de grupos, así que `00-axioms` usa
la vía escrita a mano. `DerivationStep` se diseña para que un futuro
`src/lib/engine/represent/toDerivation.ts` (`ResultDoc.trace` → la misma forma, según el
patrón documentado "un consumidor nuevo añade un `represent/toX.ts` y no toca Rust") produzca
esto sin inventar una segunda forma. Nombrar ese archivo en un comentario desde ya.

### KnowledgeGraph — `src/components/artifacts/KnowledgeGraph.tsx`

**Los datos son derivados, no escritos.** El fence solo lleva un selector de alcance:
```` ```knowledge-graph ```` con `{ "focus": "a-origins/00-axioms/sistema-formal", "depth": 2 }`.

El renderer de Astro resuelve `focus`/`depth` contra el índice de átomos **en build**, calcula
un layout DAG por capas (el grafo de `needs` es acíclico, garantizado en §6), hornea x/y en los
nodos y pasa el subgrafo resuelto como prop. Consecuencias: el navegador nunca carga el índice
entero (importa a 58 temas), no hay librería de layout en runtime, no hay salto de layout.

Implementación: envoltorio fino sobre `NodeDiagram` con `nodes`/`edges` calculados — esas props
ya existen y hoy no se usan — y un `onNodeClick` que llama `openPeek()`. Comparte el chunk de
`@xyflow` con `NodeDiagram`. No usa el motor.

---

## 8. Tareas en orden

Camino crítico marcado ★. **✅ = hecho y verificado** (ver *Dónde vamos*, arriba).

**Fase 0 — formato y modelo**
1. ✅ ★ `notes.ts`: generalizar contenedores (`childListsOf`/`withChildLists`) + los cuatro
   tipos nuevos. *Verificar:* tests de helpers; el editor no cambia a ojo.
2. ✅ ★ `src/lib/notes/format.ts` (`parseNote`/`serializeNote`) + `slug.ts`. *Dep: 1.
   Verificar:* tests de round-trip (§9).
3. ✅ ★ `src/lib/notes/render.ts` (`renderKindOf`) + `src/lib/notes/markdown.ts` (+`remarkAtomRef`). *Dep: 1.*

**Fase 1 — separación del renderer**
4. ✅ ★ Extraer `BlockView.tsx`/`LeafView.tsx`; la rama de lectura de `LeafRow` delega. *Dep: 3.
   Verificar:* editor idéntico pixel a pixel.
5. ✅ ★ `BlockRenderer.astro` + `TopicView.astro`. *Dep: 3.*

**Fase 2 — pipeline de contenido** (paralela a la Fase 1)
6. ✅ ★ `loadTopics.ts` + colecciones `topics`/`atoms` + `validateAtoms`. *Dep: 2. **Hacer aquí
   el spike del loader, primero.** Verificar:* el build falla con un `needs` roto a propósito.
7. ✅ ★ `topicRoutes.ts`; reescribir `descubre/[...slug].astro`; **crear `en/descubre/[...slug].astro`**;
   borrar el MDX y la colección `discover`. *Dep: 5, 6.*

**Fase 3 — peek**
8. ✅ ★ Endpoints `peek/[...slug].json.ts` y su gemelo `en/` (**no** `_peek/`, ver decisión 6),
   `peekUrl`/`resolveRefIn`/`allRefsIn`, `PeekDoc`/`projectPeek`, memoización. *Dep: 7.*
9. ✅ `peek.ts` (decisiones puras + bus) + `PeekHost.tsx` + `PeekPanel.tsx`. *Dep: 4, 8.*

**Fase 4 — artefactos** (independientes entre sí, paralelizables)
10. ⬜ **SIGUIENTE.** LeanProof + `MathSlice/Group.lean` + grep del teorema. *Dep: 3.* El más
    pequeño y de cero JS — hacerlo primero para sacudir el camino de atributos en el fence.
    Ojo: el plan escribe `theorem=MathSlice.x` sin comillas y la gramática (`ATTR`,
    `directives.ts:22`) las exige; sin ellas `attrs` sale `{}` y el badge dice «sin verificar»
    sin avisar.
11. DerivationStepper. *Dep: 3.*
12. AxiomToggle + `axiomSystem.ts` + los visuales Euclides/Poincaré. *Dep: 3.*
13. KnowledgeGraph. *Dep: 6, 9.*

**Fase 5 — contenido**
14. ★ Reescribir los cuatro archivos de `00-axioms`: frontmatter, backticks→LaTeX, átomos,
    artefactos, embeds. Rescatar la prosa cálida del MDX en `02-know.md`. *Dep: 7, 10–13.*
15. Actualizar `context/PLATFORM-ARCHITECTURE.md` §3 (el MDX a mano queda superado; **esto es
    el aterrizaje del editor v2**), §4 (filas de los cuatro artefactos, Lean ahora con badge),
    §8; `media/maths/CONTENT-FRAMEWORK.md` (contrato de frontmatter, convención de átomos);
    comentario de `hasContent` en `mathsTree.ts`.

**Fase 6 — verificación**
16. 🔄 Añadir Vitest y la suite. *Puede empezar tras la tarea 2 y crecer con cada fase — el test
    de round-trip se escribe **con** el parser, no después.*

**Camino crítico: 1 → 2 → 3 → 4/5 → 6 → 7 → 14.** La tarea más arriesgada es la 2, y va segunda.

---

## 9. Verificación

**Añadir Vitest.** Vite ya es el bundler de Astro, así que Vitest necesita un
`vitest.config.ts` de ~6 líneas replicando el alias `@/` y nada más. Empezar con **vitest
solo** — todo lo de alto valor aquí es lógica pura; `jsdom` + `@testing-library/react` cuando
un test de componente se lo gane. Scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.
Rust no se toca: `cargo nextest` sigue igual.

| qué | cómo |
|---|---|
| **Round-trip, corpus** | `serializeNote(parseNote(f)) === f` para todo archivo bajo `media/maths/**`. Es el gate de CI que mantiene los archivos canónicos. |
| **Round-trip, docs** | `parseNote(serializeNote(doc)) ≡ doc` módulo ids, sobre ~30 casos adversarios escritos a mano (`$$` dentro de un fence, `:::` dentro de un fence, backticks dentro de math, columns→atom→columns, un artefacto cuyo JSON contiene ```` ``` ````) + un generador determinista de 40 líneas. **Sin `fast-check`** salvo que el formato demuestre ser frágil. |
| **Fixtures golden** | `src/lib/notes/__fixtures__/*.md` ↔ `*.json`, mismo idioma que `engine/corpus/e0.json`. |
| **Dispatch** | test de tabla: cada tipo de bloque mapea a exactamente un `RenderKind`. |
| **Índice de átomos** | kind desconocido / id duplicado / `needs` sin resolver / ciclo / átomo fuera de `00-data.md` lanzan, y cada mensaje contiene `file:line`. Todo `<Atom ref>` y `::embed{ref}` del corpus resuelve. |
| **Rutas** | sin slugs duplicados; cada átomo tiene exactamente una página; **cada ruta ES tiene gemela EN** — fija la regresión del enlace muerto. |
| **Paridad editor↔archivo** | parsear un archivo real → mutar con `updateBlock`/`insertAfter` → serializar → parsear → deep-equal. Fija que el editor no pueda construir un árbol no serializable. |
| **Smoke de build** | `pnpm build` y luego aserciones sobre `dist/`: existen los HTML esperados; `dist/descubre/a-origins/00-axioms/index.html` contiene markup de KaTeX (las matemáticas de verdad prerenderizan) y `data-peek-ref`; el JS de primera carga de la página Know está bajo presupuesto. Extiende la idea de `engine/scripts/browser-check.mjs` ("mirar lo que la página pinta") en vez de inventar una paralela. |
| **Lean** | el grep del nombre del teorema es un caso de test; `pnpm engine:lean` no cambia. |
| **Manual, una vez** | abrir `/descubre/a-origins/00-axioms/dato` y el mismo archivo en el editor, lado a lado. La divergencia ahí es el modo de fallo que todo el diseño de "dos hosts, una tabla" existe para prevenir. |

---

## 10. Riesgos

1. **Pérdida en el round-trip** — el riesgo más alto, y silencioso. Cuatro mitigaciones:
   trozos verbatim (el parser nunca re-renderiza prosa); idempotencia sobre el corpus como
   gate de CI; parser que no lanza (lo desconocido degrada a texto verbatim, nunca
   desaparece); y **el guardado del editor corre `parse(serialize(doc))` y compara antes de
   escribir, negándose a escribir si no coincide**. Cinco líneas que convierten corrupción
   silenciosa en una negativa visible. Residual: las rachas de líneas en blanco entre bloques
   colapsan — documentado y normalizado una vez.

2. **localStorage vs archivo: ¿quién gana?** Política:
   - **Gana siempre el archivo.** Las notas de tema se abren *por ruta*, viven en memoria y se
     guardan de vuelta al archivo — nunca se persisten como documentos de localStorage. El
     `NoteDoc.id` de un doc-archivo es `file:media/maths/…/00-data.md`, así que la distinción
     es comprobable por máquina, no una convención.
   - **Escritura solo en dev, vía middleware de Vite** (`configureServer` en
     `astro.config.mjs`), no una API route: el proyecto es `output: static` sin adapter, así
     que `prerender = false` rompería el build. El middleware es dev por construcción y no
     toca producción. En producción la afordancia es "copiar markdown" / "descargar .md", y
     más adelante un PR.
   - La UI mantiene dos estantes visiblemente separados: "Mis documentos" (localStorage, sin
     cambios) y "Temas" (archivos).
   - Si sobreviven ediciones sin guardar, al reabrir mostrar "hay cambios más nuevos que el
     archivo — ver diferencias / descartar", **con descartar por defecto**. Nunca auto-merge.

3. **Tamaño del bundle.** `@xyflow/react` es el pesado; `mafs`, el CSS de KaTeX y `mathlive`
   ya viajan. Mitigaciones: todo artefacto es `client:visible` (ya es la regla de la casa);
   prosa, headings, columnas, átomos y LeanProof van con **cero** JS; `KnowledgeGraph` y
   `NodeDiagram` comparten chunk; el índice de átomos nunca se envía entero, solo el subgrafo
   resuelto en build. Se fija con un presupuesto sobre `dist/` en el smoke de build — el repo
   ya tiene cultura de presupuesto (`pnpm engine:size`, el límite de 3 MB del WASM).

4. **Ciclos de recursión** — tres clases distintas, tres guardas:
   - ciclo en `needs` entre átomos → DFS en build, **fatal**
   - una nota que se embebe a sí misma, directa o transitivamente → la pila del peek se niega
     a apilar un `ref` que ya está en la pila y navega en su lugar; un DFS del grafo de embeds
     en build **avisa** (un par mutuo "ver también" es legítimo, así que esta no es fatal)
   - recursión infinita en SSG → **los embeds nunca se expanden en build**. Renderizan tarjeta
     + enlace, punto. Una regla que mata la clase entera.

5. **Menores, cada uno una línea:**
   - `media/maths` es también fuente de video: publicarlo convierte ediciones de investigación
     en ediciones de producción. El flag `draft` es la guarda, y también evita que los 57
     `main.md` placeholder se conviertan en páginas.
   - El cambio de semántica de `hasContent` en `mathsTree.ts` encendería 57 temas en el explorador.
   - `isolation: isolate` de `.glass` atrapará al peek como atrapó a `MathCommandPopover`: el
     portal está especificado, no "simplificarlo".
   - Orden del Escape: `PeekHost` en fase de captura mientras la pila no esté vacía.
   - Que el loader observe una base fuera de `src/` está **sin verificar** — spike en la tarea 6.
   - `00-axioms` es solo español. La ruta EN renderiza ES con banner; es un parche deliberado,
     no un plan de traducción.

---

## Archivos críticos

- `src/lib/notes.ts` — modelo de bloques
- `src/components/notes/NotesApp.tsx:805-907` — la tabla de dispatch a extraer
- `src/content.config.ts` — colección `discover` a reemplazar
- `src/pages/descubre/[...slug].astro` — ruta a reescribir (+ crear la gemela `en/`)
- `media/maths/a-origins/00-axioms/{main,00-data,01-info,02-know}.md` — el contenido
- `context/PLATFORM-ARCHITECTURE.md` §3/§4/§8 — documentación a actualizar

# Framework de contenido: Dato → Información → Conocimiento

Todo tema hoja del árbol (`a-origins`, `b-pure`, a futuro `c-applied`) se escribe en **3 niveles de abstracción**, inspirados en los niveles de un sistema de cómputo (bajo/medio/alto nivel) y equivalentes al modelo DIKW (Data-Information-Knowledge, sin el nivel de Sabiduría — ese es transversal a toda la serie, no de un tema individual).

Cada nivel vive en su propio archivo dentro de la carpeta del tema:

```
<tema>/
├── main.md      # índice del tema, enlaza a los 3 niveles
├── 00-data.md   # Nivel 1 — Dato
├── 01-info.md   # Nivel 2 — Información
└── 02-know.md   # Nivel 3 — Conocimiento
```

## Tabla comparativa

| | `00-data.md` — Dato | `01-info.md` — Información | `02-know.md` — Conocimiento |
|---|---|---|---|
| Vista | Bottom-up: casos unitarios, mínimos, necesarios, absolutos | Del centro a los extremos (nexo) | Top-down, sistémico |
| Qué SÍ va | Axiomas, definiciones formales, notación exacta, enunciados de teoremas, taxonomía interna del tema | Implicaciones de lo anterior, relaciones entre los objetos, representaciones/diagramas, ejemplos canónicos, intuición | Conexión con otras ramas del árbol, aplicaciones reales, motivación, meta-narrativa ("para qué existe esto") |
| Qué NO va | Intuición, motivación, comparaciones externas | Axiomas sin interpretar, conexiones fuera del tema | Definiciones formales nuevas, derivaciones |
| Tono | Denso, estructurado, no busca ser ameno — es la referencia cruda, "como si del dato se tratara" | Explicativo, es el puente entre lo crudo y lo comprensible | Narrativo, el más amigable — el más cercano al gancho de un video |
| Analogía de cómputo | Bajo nivel / máquina: el sistema base, constructos que normalmente no se ven | Nivel medio / representación intermedia: ya hay estructura legible dentro del dominio | Alto nivel / arquitectura de sistema: cómo este módulo encaja con todos los demás |
| Pensamiento | Analítico | Analítico → relacional | Sistémico, no analítico |

## Nivel 1 — Dato (`00-data.md`)

Es el sustrato del tema: de qué está hecho, punto. Axiomas, definiciones formales con su notación exacta, enunciados de los teoremas fundacionales, la taxonomía interna (qué subcasos/variantes existen). Se escribe denso, ordenado y completo — el objetivo no es que se entienda de una leída, es que **esté todo y esté correcto**, como una tabla de datos. No se dan analogías, no se motiva, no se conecta con nada externo. Si algo no es un componente mínimo y necesario del tema, no va aquí.

## Nivel 2 — Información (`01-info.md`)

Es la interpretación de lo que hay en Dato. Qué implican esos axiomas, qué relaciones nacen entre los objetos definidos, cómo se ve esto (diagramas, ejemplos canónicos, casos límite instructivos). Aquí sí se explica y se da intuición, pero todavía **hacia dentro del tema** — es la vista de "centro a extremos", relacionando las piezas del Dato entre sí, no todavía con el resto del universo matemático.

## Nivel 3 — Conocimiento (`02-know.md`)

Es la vista de afuera hacia el tema: cómo se conecta con lo que no pertenece a él — otras ramas del árbol (`a-origins`/`b-pure`/`c-applied`), aplicaciones reales, historia, filosofía, por qué a alguien le importa. Pensamiento sistémico, no analítico: no se trata de descomponer el tema sino de ubicarlo en el mapa completo. Es el nivel más narrativo y el que más se parece al guion final de un video — el "para qué" y el gancho.

### Regla de meta-análisis

Si al escribir aparece contenido comparativo, histórico o filosófico, o que conecta el tema con algo fuera de él: por defecto va en **Conocimiento**. Si en cambio es una relación *interna* del propio tema (cómo dos definiciones del mismo tema interactúan entre sí), va en **Información**.

## Rol de `main.md`

`main.md` es el índice del tema, no un cuarto nivel de contenido. Contiene:
- Título y 1-2 líneas de qué es el tema.
- Enlaces a `00-data.md`, `01-info.md`, `02-know.md`.
- (Opcional) el outline narrativo del video final, que ensambla los 3 niveles en el orden que convenga al tema — no hay una regla fija de orden narrativo; frecuentemente será Conocimiento (gancho) → Información (desarrollo) → Dato (rigor/cierre), pero se decide caso por caso.

## Alcance

Este framework aplica a todo tema hoja existente y futuro. **No se ha aplicado retroactivamente** a los 58 `main.md` placeholder ya creados en `a-origins/` y `b-pure/` — el scaffold de 3 archivos (`00-data.md`, `01-info.md`, `02-know.md`) se crea tema por tema cuando le llegue el turno de escribir contenido real.

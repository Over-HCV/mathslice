---
title: Dato — Demo
level: data
---

## Definiciones

:::atom{id="fbf" kind="definition"}
**Fórmula bien formada.** Cadena que la gramática de $L$ genera.
:::

:::atom{id="sistema-formal" kind="definition" needs="fbf,regla" label="Sistema formal"}
Una tupla $(L, A, R)$ donde $A$ son los axiomas.
:::

:::atom{id="regla" kind="notation"}
## Regla de inferencia

Relación que permite derivar una fbf a partir de otras.
:::

:::atom{id="sin-titulo" kind="example"}
Prosa a secas, sin encabezado ni negrita de entrada.
:::

Un átomo dentro de una columna también cuenta:

:::::columns{widths="1,1"}
::::col
:::atom{id="dentro" kind="property" needs="z-fixture/00-demo/fbf"}
**Dentro.** Vive en una columna.
:::
::::
::::col
La otra columna no declara nada.
::::
:::::

Lo de abajo es una muestra de código, no una declaración:

```markdown
:::atom{id="mentira" kind="theorem"}
No existe.
:::
```

# Conocimiento — Axiomas

## Por qué este es el tema #1 del roadmap entero

Cada carpeta de `a-origins`, `b-pure` y `c-applied` asume, sin decirlo, que existe un punto de partida no demostrado del cual todo lo demás se deriva. Antes de hablar de números, de espacios, de cambio, hay que aceptar que **toda la matemática es hipotética**: "si aceptas estos axiomas, entonces esto otro se sigue". Este tema es el único de todo el árbol que no presupone ningún otro — es literalmente la raíz. Por eso es `00-axioms`, la primera hoja del primer nodo.

## Historia: de la evidencia a la convención

**Euclides (~300 a.C.)** trató sus 5 postulados como verdades autoevidentes sobre el espacio físico — no como una elección, sino como una descripción de cómo *es* el mundo. Durante dos milenios, el 5º postulado (paralelas) incomodó a los matemáticos: sonaba más a teorema que a axioma, y muchos intentaron demostrarlo a partir de los otros 4.

Esto desencadena el **programa de Hilbert** (principios del siglo XX): formalizar toda la matemática sobre una base axiomática completa y demostrablemente consistente — un intento de dar a toda la disciplina la misma solidez que Euclides le dio (aparentemente) a la geometría. El programa choca de frente con los **teoremas de incompletitud de Gödel** (1931): ningún sistema axiomático consistente y suficientemente potente para describir la aritmética puede ser completo. Hay verdades sobre los números naturales que ZFC + Peano no pueden ni probar ni refutar. Este es el desarrollo directo de este tema — ver `a-origins/01-mathematical-logic/03-godel-incompleteness-theorems`.

## Tres posturas filosóficas sobre "qué es" un axioma

- **Platonismo**: los objetos matemáticos existen independientemente de nosotros; los axiomas son intentos de *describir* esa realidad (postura original de Euclides sobre el espacio).
- **Formalismo** (Hilbert): la matemática es un juego de símbolos sin significado intrínseco; los axiomas son reglas del juego, elegidas por utilidad o elegancia, no por verdad.
- **Intuicionismo/constructivismo** (Brouwer): un enunciado solo es válido si se puede *construir* — rechaza herramientas como la prueba por contradicción sobre infinitos, y por tanto rechaza axiomas como el de elección en su forma clásica.

No hay resolución de este debate — la matemática moderna funciona en la práctica como formalista (ZFC como convención aceptada), pero el instinto de quien la practica suele ser platonista.

## Conexión con la analogía de cómputo de este mismo roadmap

Los axiomas son al sistema matemático lo que las **primitivas de un lenguaje o el kernel de un sistema operativo** son a todo el software que corre sobre él: no se demuestran, se *asumen como dadas*, y todo lo demás se construye por composición de esas primitivas. Cambiar el kernel (cambiar los axiomas) no produce un sistema "incorrecto" — produce un sistema *distinto*, con sus propias consecuencias. `ZFC` funciona, en ese sentido, como el "sistema operativo" que casi toda la matemática moderna da por instalado sin mencionarlo.

## Aplicación real: elegir axiomas tiene consecuencias físicas

La geometría no-euclidiana no se quedó en curiosidad abstracta: la **relatividad general de Einstein** describe la gravedad como curvatura del espacio-tiempo — geometría donde el postulado de las paralelas de Euclides simplemente no aplica. La elección de qué axiomas geométricos usar no es "más o menos correcta" en abstracto: es correcta *para el modelo que estás construyendo*. Elegir axiomas es, en la práctica, elegir qué fenómeno se quiere describir.

## El gancho

¿Por qué creemos algo en matemáticas, si no hay experimento que lo confirme? La respuesta incómoda: no lo creemos por evidencia — lo aceptamos por elección, y todo lo demás es la consecuencia lógica de esa elección. Antes de la primera demostración de este roadmap, hay una decisión que nadie demuestra.

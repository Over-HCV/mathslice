/**
 * Single switch point for which engine renders a "gráfica" block (§4 of PLATFORM-ARCHITECTURE.md:
 * "esto se pueda cambiar a futuro, por ahora se selecciona Desmos"). Flip this one constant —
 * nothing else needs to change — GraphBlock picks the component based on it.
 *
 * NOTE: Desmos expressions are Desmos/LaTeX syntax ("y=\\sin(x)"), Mafs expressions are plain JS
 * ("Math.sin(x)") — swapping the engine means re-authoring existing "mafs"-block content, there is
 * no automatic translation between the two grammars.
 */
export type GraphEngine = "desmos" | "mafs";

export const GRAPH_ENGINE: GraphEngine = "desmos";

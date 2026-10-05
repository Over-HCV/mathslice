import { GRAPH_ENGINE } from "@/lib/graphEngine";
import DesmosGraph from "@/components/artifacts/DesmosGraph";
import MafsGraph from "@/components/artifacts/MafsGraph";

/* The "gráfica" slash-block always renders through here — swap engines by flipping GRAPH_ENGINE
   in graphEngine.ts, nowhere else. `expr` syntax depends on the active engine (see graphEngine.ts).
   `onContentChange` (Desmos only, for now) is how the calculator's live state — every expression
   you add/edit/drag in its own panel, not just the first one — gets written back into the block's
   stored content, so it round-trips on export/import instead of only ever showing expression #1. */
export default function GraphBlock({
  expr,
  onContentChange,
}: {
  expr?: string;
  onContentChange?: (content: string) => void;
}) {
  return GRAPH_ENGINE === "desmos" ? (
    <DesmosGraph expr={expr} onContentChange={onContentChange} />
  ) : (
    <MafsGraph expr={expr} />
  );
}

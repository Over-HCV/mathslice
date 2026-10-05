import { ReactFlow, Background, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

/*
  NodeDiagram — react-flow (@xyflow/react) for categories/automata/graphs. Natural for
  a-origins/03-category-theory & 04-theory-of-computation. Nodes/edges come from the MDX author.
  Island (client:visible). Attribution kept (free-tier terms).
*/
const DEFAULT_NODES: Node[] = [
  { id: "a", position: { x: 40, y: 60 }, data: { label: "A" }, type: "default" },
  { id: "b", position: { x: 260, y: 20 }, data: { label: "B" }, type: "default" },
  { id: "c", position: { x: 260, y: 130 }, data: { label: "C" }, type: "default" },
];
const DEFAULT_EDGES: Edge[] = [
  { id: "f", source: "a", target: "b", label: "f", animated: true },
  { id: "g", source: "a", target: "c", label: "g" },
  { id: "gf", source: "b", target: "c", label: "g∘f" },
];

export default function NodeDiagram({
  nodes = DEFAULT_NODES,
  edges = DEFAULT_EDGES,
  height = 280,
}: {
  nodes?: Node[];
  edges?: Edge[];
  height?: number;
}) {
  return (
    <div
      className="my-6 overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface"
      style={{ height }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable
        panOnScroll={false}
        zoomOnScroll={false}
      >
        <Background gap={20} />
      </ReactFlow>
    </div>
  );
}

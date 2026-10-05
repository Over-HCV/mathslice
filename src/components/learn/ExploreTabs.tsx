import { useState } from "react";
import ColumnTree from "@/components/learn/ColumnTree";
import TreeNavigator from "@/components/learn/TreeNavigator";
import type { TreeNode } from "@/lib/mathsTree";

/*
  ExploreTabs — client-side tab switch [Temas | Problemas] so it works in a static build
  (query-param tabs don't in SSG). Temas = the column tree navigator; Problemas = a stub for now.
*/
type Labels = {
  temas: string;
  problemas: string;
  soon: string;
  soonLabel: string;
  problemsTitle: string;
  problemsBody: string;
  hint: string;
};

export default function ExploreTabs({
  tree,
  labels,
  radial = false,
}: {
  tree: TreeNode;
  labels: Labels;
  radial?: boolean;
}) {
  const initial =
    typeof location !== "undefined" && new URLSearchParams(location.search).get("tab") === "problemas"
      ? "problemas"
      : "temas";
  const [tab, setTab] = useState<"temas" | "problemas">(initial);

  const cls = (on: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
      on ? "bg-primary text-primary-ink" : "text-ink-muted hover:text-ink"
    }`;

  return (
    <div>
      <div className="glass mb-5 inline-flex gap-1 rounded-full p-1">
        <button onClick={() => setTab("temas")} className={cls(tab === "temas")}>
          {labels.temas}
        </button>
        <button onClick={() => setTab("problemas")} className={cls(tab === "problemas")}>
          {labels.problemas}
        </button>
      </div>

      {tab === "temas" ? (
        radial ? (
          <TreeNavigator tree={tree} soonLabel={labels.soonLabel} hintLabel={labels.hint} />
        ) : (
          <ColumnTree tree={tree} soonLabel={labels.soonLabel} hintLabel={labels.hint} />
        )
      ) : (
        <div className="glass max-w-lg p-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">{labels.soon}</p>
          <p className="mt-2 text-lg font-semibold text-ink">{labels.problemsTitle}</p>
          <p className="mt-2 text-ink-muted">{labels.problemsBody}</p>
        </div>
      )}
    </div>
  );
}

/*
  engineTree — the shape of engine/tree/, the capability inventory crossed with the golden
  corpus by `ms-cli tree` (pnpm engine:tree).

  This file is imported by the browser island, so it must stay free of Node built-ins.
  Reading the files is the job of engineTree.server.ts: a single `node:fs` import reachable
  from client code externalises the whole module and the island silently stops hydrating —
  the page still renders, and nothing ever responds to a click.
*/

/** A corpus case, with what the page needs to run it again against the real engine. */
export type CapabilityCase = {
  name: string;
  /** Stage the case belongs to: "E0", "E1". */
  stage: string;
  latex: string;
  /** Expected exact result, or null when the right answer is an error. */
  result_latex: string | null;
  /** Expected error kind, when the case pins one. */
  error: string | null;
};

/** A leaf of the inventory: one capability of the reference inventory. */
export type CapabilityLeaf = {
  title: string;
  /** Full path id, the same string a corpus case declares. */
  id: string;
  checked: boolean;
  cases: CapabilityCase[];
};

/** A section: it has children, never cases of its own. */
export type CapabilitySection = {
  title: string;
  leaves: number;
  covered: number;
  /** True only when every leaf below is covered. Computed by ms-cli, not written. */
  checked: boolean;
  children: CapabilityNode[];
};

export type CapabilityNode = CapabilityLeaf | CapabilitySection;

export type CategorySummary = {
  slug: string;
  title: string;
  leaves: number;
  covered: number;
  percent: number;
  /** Common Core: the curricular re-index. Has its own page, stays out of the total. */
  reindexed: boolean;
};

export type Category = CategorySummary & {
  nodes: CapabilityNode[];
};

export type TreeIndex = {
  totals: { leaves: number; covered: number; percent: number };
  categories: CategorySummary[];
};

/** Leaves carry an id; sections never do. */
export function isLeaf(node: CapabilityNode): node is CapabilityLeaf {
  return "id" in node;
}

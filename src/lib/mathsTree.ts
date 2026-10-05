import { readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

/*
  mathsTree — build-time walk of media/maths/ into a nested tree for the Aprende navigator.
  Runs in Node during SSG (Astro page frontmatter). media/maths is the source of truth for both
  the hierarchy AND the pages: a topic gets a live href once its own main.md says `draft: false`.
  Which means this walk and src/lib/notes/loadTopics.ts read the same tree for different reasons —
  this one wants every folder, published or not, because the navigator shows what is coming.
*/

export type TreeNode = {
  slug: string; // path under media/maths, e.g. "a-origins/00-axioms" ("" for root)
  name: string; // prettified label
  group: string; // top-level group id
  depth: number;
  isLeaf: boolean; // no child directories (a topic, not a grouping)
  hasContent: boolean; // published (main.md has draft: false) → clickable
  href?: string;
  children: TreeNode[];
};

const GROUPS = ["a-origins", "b-pure", "c-applied"] as const;
const GROUP_LABEL: Record<string, string> = {
  "a-origins": "Orígenes",
  "b-pure": "Puras",
  "c-applied": "Aplicadas",
};

function prettify(dirName: string): string {
  return dirName
    .replace(/^\d+-/, "")
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function subdirs(abs: string): string[] {
  try {
    return readdirSync(abs)
      .filter((n) => !n.startsWith(".") && statSync(join(abs, n)).isDirectory())
      .sort();
  } catch {
    return [];
  }
}

/**
 * @param contentSlugs topic paths that are published, e.g. "a-origins/00-axioms".
 * @param locale used to build hrefs (EN is prefixed).
 */
export function buildMathsTree(contentSlugs: Set<string>, locale: "es" | "en" = "es"): TreeNode {
  const base = resolve(process.cwd(), "media/maths");
  const prefix = locale === "en" ? "/en" : "";

  const walk = (relSlug: string, name: string, group: string, depth: number): TreeNode => {
    const abs = relSlug ? join(base, relSlug) : base;
    const dirs = subdirs(abs);
    const isLeaf = dirs.length === 0;
    const hasContent = contentSlugs.has(relSlug);
    return {
      slug: relSlug,
      name,
      group,
      depth,
      isLeaf,
      hasContent,
      href: hasContent ? `${prefix}/descubre/${relSlug}` : undefined,
      children: dirs.map((d) =>
        walk(relSlug ? `${relSlug}/${d}` : d, prettify(d), group || d, depth + 1),
      ),
    };
  };

  const groups: TreeNode[] = GROUPS.filter((g) => existsSync(join(base, g))).map((g) =>
    walk(g, GROUP_LABEL[g] ?? prettify(g), g, 1),
  );

  return {
    slug: "",
    name: "Matemáticas",
    group: "root",
    depth: 0,
    isLeaf: false,
    hasContent: false,
    children: groups,
  };
}

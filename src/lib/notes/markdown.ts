/*
  markdown.ts — one markdown pipeline, shared by the editor, the peek panel and the published page.

  These three used to be one place (LeafRow) and are now three; if each configured its own plugin
  list, a table would render on the site and not in the editor, or `$x$` would be maths in one and
  literal dollars in another. The list lives here so that cannot happen.
*/

import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import { INLINE_ATOM, parseAttrs } from "./directives";

/*
 * `<Atom ref="…">texto</Atom>` written inside a sentence.
 *
 * Two facts force this to be a remark plugin rather than raw HTML. react-markdown disallows raw
 * HTML by default (turning it on would let any note inject markup), so the tag arrives as plain
 * TEXT — which is exactly what we want to match on. And the labelled form is the one that survives
 * GitHub, whose sanitiser drops unknown tags but keeps their children.
 *
 * The pattern itself is directives.ts's, because it is grammar; this file only turns matches into
 * nodes. `inlineRefsIn` lives there too, so a build-time consumer never imports this pipeline.
 */

/** The tag name the renderer maps to a component. Hyphenated so it can never collide with HTML. */
export const ATOM_REF_TAG = "atom-ref";

type MdNode = { type: string; value?: string; children?: MdNode[]; data?: Record<string, unknown> };

export function remarkAtomRef() {
  return (tree: MdNode) => visitParents(tree);
}

/** Replace matches inside every text node, in place. Written by hand rather than pulling in
 *  unist-util-visit, which is only in the store transitively via remark. */
function visitParents(node: MdNode): void {
  if (!node.children) return;

  const next: MdNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && child.value && child.value.includes("<Atom")) next.push(...splitAtomRefs(child.value));
    else {
      visitParents(child);
      next.push(child);
    }
  }
  node.children = next;
}

function splitAtomRefs(value: string): MdNode[] {
  const out: MdNode[] = [];
  let cursor = 0;

  for (const m of value.matchAll(INLINE_ATOM)) {
    const ref = parseAttrs(m[1]).ref;
    if (!ref) continue; // Not a ref we can resolve; leave the text alone rather than eat it.
    if (m.index > cursor) out.push({ type: "text", value: value.slice(cursor, m.index) });
    const label = m[2] ?? "";
    out.push({
      type: "atomRef",
      data: { hName: ATOM_REF_TAG, hProperties: { ref, label } },
      children: label ? [{ type: "text", value: label }] : [],
    });
    cursor = m.index + m[0].length;
  }

  if (!out.length) return [{ type: "text", value }];
  if (cursor < value.length) out.push({ type: "text", value: value.slice(cursor) });
  return out;
}

export const REMARK_PLUGINS = [remarkGfm, remarkMath, remarkAtomRef];
export const REHYPE_PLUGINS = [rehypeKatex];

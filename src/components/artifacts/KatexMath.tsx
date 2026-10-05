import katex from "katex";
import "katex/dist/katex.min.css";

/*
  KatexMath — the single KaTeX entry point for the whole app.

  It calls katex.renderToString directly instead of going through react-katex, so there is exactly
  one place that turns LaTeX into markup.

  That matters because of the bug this replaced. package.json asked for katex ^0.18.1 while every
  consumer in the tree — rehype-katex, remark-math, mafs, react-katex — pins ^0.16. So the CSS came
  from 0.18.1 and ALL the rendering JS from 0.16.47. The 0.18 stylesheet no longer ships `.base`,
  `.strut` or `.sizing`, which 0.16 still emits and which carry the layout: without
  `.base { display: inline-block }` a fraction's vertical list collapses and the glyphs run
  together — `\frac{8796093022211}{8}` came out as `87960930222118`.

  Hence katex is pinned to ^0.16.47 (matching every consumer) and react-katex is gone. Keep it that
  way: bumping katex past the version rehype-katex/mafs depend on silently reintroduces the split,
  and it fails as broken layout rather than as a build error.

  renderToString is synchronous and has no DOM dependency, so this still prerenders to static HTML
  in MDX (no client: directive, zero JS shipped) — the property Latex.tsx relies on.
*/
export default function KatexMath({
  math,
  block = false,
}: {
  math: string;
  /** Display mode: centered, full-size operators. Otherwise it flows inside the sentence. */
  block?: boolean;
}) {
  // throwOnError:false returns KaTeX's own error markup instead of throwing. Input reaches here
  // straight from the engine or from what the user typed, and neither should be able to blank the
  // page — a formula KaTeX cannot read shows up marked, in place.
  const html = katex.renderToString(math, { displayMode: block, throwOnError: false });

  // The output is KaTeX's, built from a parsed AST — it never echoes raw input as markup.
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

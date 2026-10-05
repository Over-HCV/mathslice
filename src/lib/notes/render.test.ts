import { describe, expect, it } from "vitest";

import { inlineRefsIn } from "./directives";
import { parseNote } from "./format";
import { allRefsIn, refsIn, renderKindOf, type RenderKind } from "./render";
import { makeSlugger, slugify } from "./slug";

/** The render kind of a document's first block — how every case below is stated. */
const kindOf = (md: string): RenderKind => renderKindOf(parseNote(md).doc.blocks[0]);

describe("dispatch", () => {
  it("reads a fence as code, not as the maths inside it", () => {
    // The ordering bug this pins: `$$` inside a js fence is a code sample, not an equation.
    expect(kindOf("```js\nconst s = '$$x$$';\n```\n")).toMatchObject({ kind: "code", lang: "js", runnable: "js" });
  });

  it("marks a non-runnable fence as static", () => {
    expect(kindOf("```rust\nfn main() {}\n```\n")).toMatchObject({ kind: "code", runnable: null });
  });

  it("carries the theorem name off a lean fence", () => {
    expect(kindOf('```lean theorem="MathSlice.inverse_unique"\nsorry\n```\n')).toEqual({
      kind: "lean",
      code: "sorry",
      theorem: "MathSlice.inverse_unique",
    });
  });

  it("leaves an unclaimed lean fence marked rather than hidden", () => {
    expect(kindOf("```lean\nsorry\n```\n")).toMatchObject({ kind: "lean", theorem: null });
  });

  it("parses an artifact's JSON once, for both hosts", () => {
    expect(kindOf('```axiom-toggle\n{ "system": "euclid" }\n```\n')).toEqual({
      kind: "artifact",
      name: "axiom-toggle",
      props: { system: "euclid" },
      error: null,
    });
  });

  it("reports broken artifact JSON instead of throwing", () => {
    const rk = kindOf("```axiom-toggle\n{ nope\n```\n");
    expect(rk).toMatchObject({ kind: "artifact", props: null });
    expect(rk.kind === "artifact" && rk.error).toBeTruthy();
  });

  it("treats an empty artifact body as 'use your defaults'", () => {
    expect(kindOf("```diagram\n```\n")).toMatchObject({ kind: "artifact", name: "diagram", props: null, error: null });
  });

  it("falls back to a visible curve for an empty graph", () => {
    expect(kindOf("```mafs\n```\n")).toEqual({ kind: "mafs", expr: "y=\\sin(x)" });
  });

  it("anchors a heading the way GitHub would", () => {
    expect(kindOf("### Definiciones formales\n")).toEqual({
      kind: "heading",
      level: 3,
      text: "Definiciones formales",
      anchor: "definiciones-formales",
    });
  });

  it("recognises embeds and atom refs", () => {
    expect(kindOf('::embed[El mecanismo]{ref="a-origins/00-axioms/info"}\n')).toEqual({
      kind: "embed",
      ref: "a-origins/00-axioms/info",
      label: "El mecanismo",
    });
    expect(kindOf('<Atom ref="a-origins/00-axioms/axioma" />\n')).toMatchObject({ kind: "atomref", label: "" });
  });

  it("falls through to markdown for ordinary prose", () => {
    expect(kindOf("Un axioma es un **punto de partida**.\n")).toMatchObject({ kind: "markdown" });
  });
});

describe("refs", () => {
  it("collects block refs from inside containers", () => {
    const md =
      ':::atom{id="a" kind="definition"}\n::embed{ref="uno"}\n:::\n\n::::columns{widths="1,1"}\n:::col\n<Atom ref="dos" />\n:::\n:::col\nTexto.\n:::\n::::\n';
    expect(refsIn(parseNote(md).doc.blocks)).toEqual(["uno", "dos"]);
  });

  it("collects refs written inline in a sentence", () => {
    expect(inlineRefsIn('Un <Atom ref="x/sistema-formal">sistema formal</Atom> y otro <Atom ref="x/modelo" />.')).toEqual(
      ["x/sistema-formal", "x/modelo"],
    );
  });

  it("allRefsIn sees both kinds, including inline ones nested in containers", () => {
    const md =
      '::embed{ref="bloque"}\n\n' +
      'Un <Atom ref="prosa">término</Atom>.\n\n' +
      ':::atom{id="a" kind="definition"}\nDentro va <Atom ref="dentro">otro</Atom>.\n:::\n';
    expect(allRefsIn(parseNote(md).doc.blocks).sort()).toEqual(["bloque", "dentro", "prosa"]);
  });
});

describe("slugs", () => {
  it("keeps accents, as GitHub does", () => {
    expect(slugify("Información y Dato")).toBe("información-y-dato");
  });

  it("drops punctuation and collapses whitespace", () => {
    expect(slugify("¿Por qué  este tema? (el #1)")).toBe("por-qué-este-tema-el-1");
  });

  it("numbers repeats within one document", () => {
    const slug = makeSlugger();
    expect([slug("Notas"), slug("Notas"), slug("Notas")]).toEqual(["notas", "notas-1", "notas-2"]);
  });
});

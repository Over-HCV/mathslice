/*
  The two laws of format.ts, plus the cases that broke them while it was being written.

  Law 2 compares MODULO IDS: block ids are regenerated on every parse and deliberately never
  written to the file, so comparing them would be comparing the random number generator.
*/

import { describe, expect, it } from "vitest";

import { parseNote, serializeNote, type ParsedNote } from "./format";
import { detectFence, detectMath, isAtom, isColumns, type Block } from "./model";

/** A doc stripped of the ids the format does not carry — what "same document" means here. */
function shape(blocks: Block[]): unknown {
  return blocks.map((b) => {
    if (isColumns(b)) return { type: b.type, widths: b.widths, columns: b.columns.map((c) => shape(c.blocks)) };
    if (isAtom(b)) return { type: b.type, atomId: b.atomId, kind: b.kind, needs: b.needs, label: b.label, blocks: shape(b.blocks) };
    return { type: b.type, content: b.content };
  });
}

const roundTrip = (md: string): ParsedNote => parseNote(serializeNote(parseNote(md)));

/** Law 1 for one document: parsing then serialising gives back exactly what went in. */
function expectStable(md: string) {
  expect(serializeNote(parseNote(md))).toBe(md);
}

/** Law 2 for one document: the second parse sees the same document as the first. */
function expectSameDoc(md: string) {
  expect(shape(roundTrip(md).doc.blocks)).toEqual(shape(parseNote(md).doc.blocks));
}

function expectRoundTrip(md: string) {
  expectStable(md);
  expectSameDoc(md);
}

describe("prose", () => {
  it("keeps a paragraph verbatim", () => {
    expectRoundTrip("Un axioma es un punto de partida.\n");
  });

  it("does not normalise markdown it does not own", () => {
    // An AST round-trip would rewrite `*` to `_`, re-pad the table and renumber the list. The
    // whole no-remark decision exists for this test.
    const md = "Texto con *énfasis* y __negrita__.\n\n| a |  b |\n|---|----|\n| 1 |  2 |\n\n3. uno\n4. dos\n";
    expectRoundTrip(md);
  });

  it("splits paragraphs on blank lines", () => {
    const { doc } = parseNote("Uno.\n\nDos.\n");
    expect(doc.blocks).toHaveLength(2);
  });

  it("ends a paragraph at a heading with no blank line before it", () => {
    const { doc } = parseNote("Texto.\n## Título\n");
    expect(doc.blocks.map((b) => b.type)).toEqual(["text", "heading"]);
  });
});

describe("frontmatter", () => {
  it("parses it for reading and re-emits the source verbatim", () => {
    const md = '---\ntitle: "Dato — Axiomas"\nlevel: data\nneeds:\n  - a\n  - b\n---\n\nCuerpo.\n';
    expect(parseNote(md).frontmatter.level).toBe("data");
    expect(parseNote(md).doc.title).toBe("Dato — Axiomas");
    expectStable(md);
  });

  it("survives malformed YAML without losing the body", () => {
    const md = "---\ntitle: [unclosed\n---\n\nEl cuerpo sigue aquí.\n";
    const { doc, frontmatter } = parseNote(md);
    expect(frontmatter).toEqual({});
    expect(doc.blocks).toHaveLength(1);
  });
});

describe("fences", () => {
  it("keeps a code fence verbatim, info string and all", () => {
    expectRoundTrip('```lean theorem="MathSlice.inverse_unique_sound"\ntheorem t : True := trivial\n```\n');
  });

  it("exposes fence attributes to the render layer", () => {
    const { doc } = parseNote('```lean theorem="MathSlice.t"\nsorry\n```\n');
    const fence = detectFence((doc.blocks[0] as { content: string }).content);
    expect(fence).toMatchObject({ lang: "lean", attrs: { theorem: "MathSlice.t" } });
  });

  it("does not read structure inside a fence body", () => {
    // Every one of these would be a block boundary outside a fence.
    expectRoundTrip("```js\n:::atom{id=\"x\"}\n$$y$$\n## no soy un título\n```\n");
  });

  it("keeps an artifact fence whole, JSON and all", () => {
    expectRoundTrip('```axiom-toggle\n{ "system": "euclid", "axioms": ["p1"] }\n```\n');
  });

  it("unwraps mafs and diagram, which have their own editor block type", () => {
    const { doc } = parseNote("```mafs\ny=\\sin(x)\n```\n");
    expect(doc.blocks[0]).toMatchObject({ type: "mafs", content: "y=\\sin(x)" });
    expectRoundTrip("```mafs\ny=\\sin(x)\n```\n");
  });

  it("survives a fence that never closes", () => {
    const { doc } = parseNote("```js\nconsole.log(1)\n");
    expect(doc.blocks).toHaveLength(1);
  });

  it("handles a fence whose body contains a shorter fence", () => {
    expectRoundTrip("````md\n```js\n1\n```\n````\n");
  });
});

describe("maths", () => {
  it("keeps a multi-line $$ block as one block", () => {
    const md = "$$\nA \\vdash \\varphi \\\\ M \\models A\n$$\n";
    const { doc } = parseNote(md);
    expect(doc.blocks).toHaveLength(1);
    expect(detectMath((doc.blocks[0] as { content: string }).content)?.lines).toHaveLength(2);
    expectRoundTrip(md);
  });

  it("keeps a one-line $$ block as one block", () => {
    expectRoundTrip("$$e^{i\\pi}+1=0$$\n");
  });

  it("does not read a fence inside maths as structure", () => {
    expectRoundTrip("$$\n\\text{```}\n$$\n");
  });
});

describe("atoms", () => {
  const md =
    '---\nlevel: data\n---\n\n:::atom{id="sistema-formal" kind="definition" needs="fbf,regla-inferencia"}\n**Sistema formal.** Una tupla $(L, A, R)$.\n\n$$L \\vdash \\varphi$$\n:::\n';

  it("round-trips with its attributes and its body", () => {
    const atom = parseNote(md).doc.blocks[0];
    expect(atom).toMatchObject({
      type: "atom",
      atomId: "sistema-formal",
      kind: "definition",
      needs: ["fbf", "regla-inferencia"],
    });
    expect(isAtom(atom) && atom.blocks).toHaveLength(2);
    expectRoundTrip(md);
  });

  it("degrades an unknown kind instead of losing the atom", () => {
    const atom = parseNote(':::atom{id="x" kind="inventado"}\nCuerpo.\n:::\n').doc.blocks[0];
    expect(atom).toMatchObject({ type: "atom", kind: "definition" });
  });

  it("keeps an atom with no id as verbatim text rather than guessing an id", () => {
    const { doc } = parseNote(':::atom{kind="definition"}\nCuerpo.\n:::\n');
    expect(doc.blocks[0].type).toBe("text");
  });
});

describe("columns", () => {
  it("round-trips two columns with widths", () => {
    const md = '::::columns{widths="1,2"}\n:::col\nIzquierda.\n:::\n:::col\n$$x+1$$\n:::\n::::\n';
    const cols = parseNote(md).doc.blocks[0];
    expect(cols).toMatchObject({ type: "columns", widths: [1, 2] });
    expectRoundTrip(md);
  });

  it("nests: an atom inside a column, with the minimum colon depth that still closes", () => {
    // The atom closes on `:::`, so its column must use 4 and the columns block 5. Writing more
    // colons than that is legal input but not canonical — see the next test.
    const md =
      ':::::columns{widths="1,1"}\n::::col\n:::atom{id="a" kind="definition"}\nDentro.\n:::\n::::\n::::col\nDerecha.\n::::\n:::::\n';
    expectRoundTrip(md);
  });

  it("reads a hand-written file with deeper colons, then canonicalises it", () => {
    const loose =
      '::::::columns{widths="1,1"}\n:::::col\n:::atom{id="a" kind="definition"}\nDentro.\n:::\n:::::\n:::::col\nDerecha.\n:::::\n::::::\n';
    const canonical = serializeNote(parseNote(loose));
    expect(shape(parseNote(canonical).doc.blocks)).toEqual(shape(parseNote(loose).doc.blocks));
    expectStable(canonical);
  });

  it("gives every column a width even when the attribute lies", () => {
    const cols = parseNote('::::columns{widths="1"}\n:::col\nA\n:::\n:::col\nB\n:::\n::::\n').doc.blocks[0];
    expect(isColumns(cols) && cols.widths).toEqual([1, 1]);
  });

  it("keeps a columns directive with no columns as verbatim text", () => {
    expect(parseNote('::::columns{widths="1,1"}\nSin columnas.\n::::\n').doc.blocks[0].type).toBe("text");
  });
});

describe("embeds and atom refs", () => {
  it("keeps an embed as one verbatim line", () => {
    expectRoundTrip('::embed[Cómo un axioma genera teoremas]{ref="a-origins/00-axioms/info#el-mecanismo"}\n');
  });

  it("keeps a block-level atom ref verbatim", () => {
    expectRoundTrip('<Atom ref="a-origins/00-axioms/sistema-formal" />\n');
  });

  it("keeps an inline atom ref inside its sentence", () => {
    expectRoundTrip('La noción de <Atom ref="…/sistema-formal">sistema formal</Atom> exige más.\n');
  });
});

describe("unknown constructs", () => {
  it("never throws and never drops a directive it does not know", () => {
    const md = ':::callout{tone="warn"}\nAlgo que este parser no conoce todavía.\n:::\n';
    expect(() => parseNote(md)).not.toThrow();
    expectRoundTrip(md);
  });

  it("handles an empty document", () => {
    expect(parseNote("").doc.blocks).toHaveLength(1);
  });
});

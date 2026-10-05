import { describe, expect, it } from "vitest";

import type { Level } from "@/i18n";
import type { AtomRecord, TopicIndex, TopicManifest, TopicRecord } from "./loadTopics";
import { assertTopicIndex, validateTopicIndex } from "./validate";

/*
  Validation runs against a hand-built index rather than files on disk. That is the whole reason
  validateTopicIndex takes a TopicIndex instead of a path: the loader gets its answers after
  reading 60 files, these get theirs in microseconds, and both go through the same code.
*/

const TOPIC = "a-origins/00-axioms";
const DATA_FILE = `media/maths/${TOPIC}/00-data.md`;

let line = 0;

function atom(localId: string, over: Partial<AtomRecord> = {}): AtomRecord {
  return {
    id: `es/${TOPIC}/${localId}`,
    ref: `${TOPIC}/${localId}`,
    localId,
    topic: TOPIC,
    level: "data",
    lang: "es",
    kind: "definition",
    declaredKind: "definition",
    needs: [],
    title: localId,
    blocks: [],
    source: { file: DATA_FILE, line: ++line },
    ...over,
  };
}

function topic(level: Level, refs: string[] = [], over: Partial<TopicRecord> = {}): TopicRecord {
  return {
    id: `es/${TOPIC}/${level}`,
    ref: `${TOPIC}/${level}`,
    topic: TOPIC,
    group: "a-origins",
    level,
    lang: "es",
    title: "Axiomas",
    summary: "",
    draft: false,
    order: [0, 0],
    blocks: [],
    refs,
    file: `media/maths/${TOPIC}/0${level === "data" ? 0 : level === "info" ? 1 : 2}-${level}.md`,
    ...over,
  };
}

function manifest(over: Partial<TopicManifest> = {}): TopicManifest {
  return {
    topic: TOPIC,
    group: "a-origins",
    order: [0, 0],
    title: "Axiomas",
    summary: "",
    draft: false,
    file: `media/maths/${TOPIC}/main.md`,
    ...over,
  };
}

const index = (over: Partial<TopicIndex> = {}): TopicIndex => ({
  manifests: [manifest()],
  topics: [topic("know"), topic("info"), topic("data")],
  atoms: [],
  ...over,
});

const messages = (i: TopicIndex): string[] => validateTopicIndex(i).errors.map((e) => e.message);

describe("atoms", () => {
  it("accepts a well-formed index", () => {
    const ok = index({ atoms: [atom("fbf"), atom("sistema-formal", { needs: [`${TOPIC}/fbf`] })] });
    expect(validateTopicIndex(ok).errors).toEqual([]);
  });

  it("rejects a kind outside the closed set, naming the typo", () => {
    const errors = validateTopicIndex(index({ atoms: [atom("x", { declaredKind: "definicion" })] })).errors;
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('kind="definicion"');
    expect(errors[0].file).toBe(DATA_FILE);
    expect(errors[0].line).toBeGreaterThan(0);
  });

  it("rejects a missing kind", () => {
    expect(messages(index({ atoms: [atom("x", { declaredKind: "" })] }))).toHaveLength(1);
  });

  it("rejects a duplicate id and points at the first declaration", () => {
    const first = atom("modelo");
    const second = atom("modelo");
    const errors = validateTopicIndex(index({ atoms: [first, second] })).errors;
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(second.source.line);
    expect(errors[0].message).toContain(`${first.source.file}:${first.source.line}`);
  });

  /*
    The absurd case that would otherwise ship as one page silently overwriting another: an atom
    page lives at `<topic>/atomo/<id>`, so a topic folder literally named `atomo` puts its
    `informacion` page exactly where atom `informacion` of the parent topic goes.
  */
  it("rejects two records that would be published at the same URL", () => {
    const parent = "a-origins";
    const collision = index({
      manifests: [manifest({ topic: `${parent}/atomo` })],
      topics: [
        topic("info", [], {
          id: `es/${parent}/atomo/info`,
          ref: `${parent}/atomo/info`,
          topic: `${parent}/atomo`,
          file: `media/maths/${parent}/atomo/01-info.md`,
        }),
      ],
      atoms: [
        atom("informacion", {
          id: `es/${parent}/informacion`,
          ref: `${parent}/informacion`,
          topic: parent,
        }),
      ],
    });
    const errors = validateTopicIndex(collision).errors;
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("comparte ruta");
    expect(errors[0].message).toContain(`media/maths/${parent}/atomo/01-info.md:1`);
  });

  it("lets two translations of one page share a slug", () => {
    const both = index({
      topics: [topic("data"), topic("data", [], { id: `en/${TOPIC}/data`, lang: "en" })],
    });
    expect(validateTopicIndex(both).errors).toEqual([]);
  });

  it("allows the same local id in two different topics", () => {
    const other = atom("modelo", {
      id: "es/b-pure/00-algebra/modelo",
      ref: "b-pure/00-algebra/modelo",
      topic: "b-pure/00-algebra",
    });
    expect(validateTopicIndex(index({ atoms: [atom("modelo"), other] })).errors).toEqual([]);
  });

  it("rejects an atom declared outside the data level", () => {
    const errors = messages(index({ atoms: [atom("x", { level: "info" })] }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('nivel "info"');
  });

  it("rejects an unresolved need", () => {
    const errors = messages(index({ atoms: [atom("teorema", { needs: [`${TOPIC}/axima`] })] }));
    expect(errors).toEqual([expect.stringContaining("axima")]);
  });
});

describe("needs cycles", () => {
  it("reports a two-atom cycle once, naming both", () => {
    const a = atom("a", { needs: [`${TOPIC}/b`] });
    const b = atom("b", { needs: [`${TOPIC}/a`] });
    const errors = messages(index({ atoms: [a, b] }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("ciclo en needs");
    expect(errors[0]).toContain(`${TOPIC}/a`);
    expect(errors[0]).toContain(`${TOPIC}/b`);
  });

  it("reports an atom that needs itself", () => {
    expect(messages(index({ atoms: [atom("a", { needs: [`${TOPIC}/a`] })] }))).toEqual([
      expect.stringContaining("ciclo en needs"),
    ]);
  });

  it("does not mistake a diamond for a cycle", () => {
    const atoms = [
      atom("base"),
      atom("left", { needs: [`${TOPIC}/base`] }),
      atom("right", { needs: [`${TOPIC}/base`] }),
      atom("top", { needs: [`${TOPIC}/left`, `${TOPIC}/right`] }),
    ];
    expect(validateTopicIndex(index({ atoms })).errors).toEqual([]);
  });
});

describe("refs", () => {
  const withRefs = (refs: string[], atoms: AtomRecord[] = []) =>
    index({ topics: [topic("know", refs), topic("info"), topic("data")], atoms });

  it("resolves a level ref, anchor and all", () => {
    expect(validateTopicIndex(withRefs([`${TOPIC}/info#el-mecanismo`])).errors).toEqual([]);
  });

  it("resolves an atom ref", () => {
    expect(validateTopicIndex(withRefs([`${TOPIC}/sistema-formal`], [atom("sistema-formal")])).errors).toEqual([]);
  });

  it("rejects a ref to a level that does not exist", () => {
    expect(messages(withRefs(["b-pure/99-nope/info"]))).toEqual([expect.stringContaining("sin resolver")]);
  });

  it("rejects a ref to an atom that does not exist", () => {
    expect(messages(withRefs([`${TOPIC}/sistema-formals`]))).toEqual([expect.stringContaining("sin resolver")]);
  });

  it("rejects a ref with no topic at all", () => {
    expect(messages(withRefs(["sistema-formal"]))).toEqual([expect.stringContaining("malformada")]);
  });

  it("reports each broken ref once, however often it appears", () => {
    expect(messages(withRefs(["b-pure/99-nope/info", "b-pure/99-nope/info"]))).toHaveLength(1);
  });

  it("warns, but does not fail, when a published page links into a draft", () => {
    const draft = manifest({ topic: "b-pure/00-algebra", draft: true });
    const result = validateTopicIndex(
      index({
        manifests: [manifest(), draft],
        topics: [
          topic("know", ["b-pure/00-algebra/know"]),
          topic("info"),
          topic("data"),
          {
            ...topic("know"),
            id: "es/b-pure/00-algebra/know",
            ref: "b-pure/00-algebra/know",
            topic: "b-pure/00-algebra",
            draft: true,
          },
        ],
      }),
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([expect.objectContaining({ message: expect.stringContaining("borrador") })]);
  });
});

describe("assertTopicIndex", () => {
  it("throws one error listing every problem, each with file:line", () => {
    const broken = index({ atoms: [atom("x", { declaredKind: "nope", needs: [`${TOPIC}/ghost`] })] });
    expect(() => assertTopicIndex(broken)).toThrow(new RegExp(`${DATA_FILE}:\\d+ — `));
    expect(() => assertTopicIndex(broken)).toThrow(/ghost/);
  });

  it("returns the warnings when nothing is fatal", () => {
    expect(assertTopicIndex(index()).errors).toEqual([]);
  });
});

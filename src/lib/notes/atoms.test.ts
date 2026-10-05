import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseNote, serializeNote } from "./format";
import { loadTopicIndex, type AtomRecord } from "./loadTopics";
import { validateTopicIndex } from "./validate";

/*
  The atom index, read out of a fixture tree rather than the real corpus.

  media/maths has no atoms in it yet — the migration of 00-axioms is what puts them there — and a
  test that waits for content is a test that does not exist. The fixture mirrors the real layout
  exactly (root/media/maths/<group>/<topic>/…), so it exercises the same code path a real topic
  will, including the parts nobody would write by accident: an atom inside a column, and a
  `:::atom{` that is only a code sample.
*/

const ROOT = fileURLToPath(new URL("./__fixtures__/root", import.meta.url));
const TOPIC = "z-fixture/00-demo";

const index = loadTopicIndex(ROOT);
const byId = new Map(index.atoms.filter((a) => a.lang === "es").map((a) => [a.localId, a]));
const atom = (localId: string): AtomRecord => {
  const found = byId.get(localId);
  if (!found) throw new Error(`el fixture no declara "${localId}"`);
  return found;
};

describe("finding atoms", () => {
  it("collects every declaration, including the one nested in a column", () => {
    expect([...byId.keys()].sort()).toEqual(["dentro", "fbf", "regla", "sin-titulo", "sistema-formal"]);
  });

  it("ignores a declaration that is only a code sample", () => {
    expect(byId.has("mentira")).toBe(false);
  });

  it("keys the record by language and points refs at the idea", () => {
    expect(atom("fbf").id).toBe(`es/${TOPIC}/fbf`);
    expect(atom("fbf").ref).toBe(`${TOPIC}/fbf`);
    expect(atom("fbf").topic).toBe(TOPIC);
  });

  it("keeps the declared kind next to the parsed one", () => {
    expect(atom("regla").kind).toBe("notation");
    expect(atom("regla").declaredKind).toBe("notation");
  });
});

describe("source positions", () => {
  const lineOf = (localId: string): string => {
    const { file, line } = atom(localId).source;
    return readFileSync(file, "utf8").split("\n")[line - 1];
  };

  it("points at the line that declares the atom", () => {
    expect(lineOf("fbf")).toContain('id="fbf"');
    expect(lineOf("sistema-formal")).toContain('id="sistema-formal"');
  });

  it("stays correct for an atom nested inside a column", () => {
    expect(lineOf("dentro")).toContain('id="dentro"');
  });

  it("reports the file relative to the project root", () => {
    expect(atom("fbf").source.file).toMatch(/00-data\.md$/);
  });
});

describe("needs", () => {
  it("resolves a bare id against its own topic", () => {
    expect(atom("sistema-formal").needs).toEqual([`${TOPIC}/fbf`, `${TOPIC}/regla`]);
  });

  it("leaves an already-global id alone", () => {
    expect(atom("dentro").needs).toEqual([`${TOPIC}/fbf`]);
  });
});

describe("titles", () => {
  it("prefers the label attribute", () => {
    expect(atom("sistema-formal").title).toBe("Sistema formal");
  });

  it("falls back to the bold lead-in, without its full stop", () => {
    expect(atom("fbf").title).toBe("Fórmula bien formada");
  });

  it("falls back to a heading", () => {
    expect(atom("regla").title).toBe("Regla de inferencia");
  });

  it("falls back to the id when the body names nothing", () => {
    expect(atom("sin-titulo").title).toBe("Sin Titulo");
  });
});

describe("refs and translations", () => {
  it("collects block-level and inline refs from the same file", () => {
    const info = index.topics.find((t) => t.level === "info")!;
    expect(info.refs).toEqual([
      `${TOPIC}/fbf`,
      `${TOPIC}/data#definiciones`,
      `${TOPIC}/sistema-formal`,
      `${TOPIC}/regla`,
    ]);
  });

  it("loads a translated level file as its own record", () => {
    const en = index.topics.filter((t) => t.lang === "en");
    expect(en.map((t) => t.id).sort()).toEqual([`en/${TOPIC}/data`, `en/${TOPIC}/know`]);
    expect(en.find((t) => t.level === "know")?.title).toBe("Knowledge — Demo");
  });

  it("does not read a translated atom as a duplicate of the one it translates", () => {
    const both = index.atoms.filter((a) => a.localId === "fbf");
    expect(both.map((a) => a.id).sort()).toEqual([`en/${TOPIC}/fbf`, `es/${TOPIC}/fbf`]);
    expect(new Set(both.map((a) => a.ref)).size).toBe(1);
    expect(validateTopicIndex(index).errors).toEqual([]);
  });

  it("inherits summary and draft from the manifest", () => {
    expect(index.topics.every((t) => t.draft === false)).toBe(true);
    expect(index.topics[0].summary).toBe("Un tema de mentira que ejercita el loader.");
  });

  it("validates clean", () => {
    expect(validateTopicIndex(index).errors).toEqual([]);
  });
});

describe("the fixture itself", () => {
  it.each([...index.manifests.map((m) => m.file), ...index.topics.map((t) => t.file)])(
    "%s round-trips byte for byte",
    (file) => {
      const source = readFileSync(file, "utf8");
      expect(serializeNote(parseNote(source))).toBe(source);
    },
  );
});

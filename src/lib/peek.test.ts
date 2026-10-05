import { describe, expect, it } from "vitest";

import { parseNote } from "@/lib/notes/format";
import { allRefsIn } from "@/lib/notes/render";
import {
  decidePeek,
  MAX_PEEK_DEPTH,
  peekEntry,
  peekReducer,
  projectPeek,
  shouldPeek,
  type ClickLike,
  type PeekDoc,
  type PeekEntry,
  type PeekSource,
} from "./peek";

/*
  The assertion that matters here is the projection: a peek file must carry the links its own
  blocks can reach and not one entry more. Regressing that puts the site's whole link table — a few
  hundred entries — inside every peek JSON, and it fails silently, as weight rather than as a bug.
*/

const LINKS = {
  "a-origins/00-axioms/info": { href: "/descubre/a-origins/00-axioms/informacion", title: "Información" },
  "a-origins/00-axioms/know": { href: "/descubre/a-origins/00-axioms", title: "Conocimiento" },
  "a-origins/00-axioms/modelo": { href: "/descubre/a-origins/00-axioms/atomo/modelo", title: "Modelo" },
  "b-pure/00-algebra/know": { href: "/descubre/b-pure/00-algebra", title: "Álgebra" },
};

const source = (md: string, over: Partial<PeekSource> = {}): PeekSource => ({
  route: { kind: "level", level: "data", locale: "es", translated: true },
  title: "Dato — Axiomas",
  summary: "",
  blocks: parseNote(md).doc.blocks,
  links: LINKS,
  atomHrefs: {},
  needs: [],
  ...over,
});

const project = (md: string, over: Partial<PeekSource> = {}) => {
  const s = source(md, over);
  return projectPeek(s, allRefsIn(s.blocks), { ref: "a-origins/00-axioms/data", href: "/x" });
};

describe("projectPeek", () => {
  it("keeps only the links the blocks reach", () => {
    const doc = project('::embed{ref="a-origins/00-axioms/info"}\n');
    expect(Object.keys(doc.links)).toEqual(["a-origins/00-axioms/info"]);
  });

  it("keys an anchored ref by the document it points into", () => {
    const doc = project('::embed{ref="a-origins/00-axioms/info#el-mecanismo"}\n');
    expect(doc.links).toEqual({ "a-origins/00-axioms/info": LINKS["a-origins/00-axioms/info"] });
  });

  it("reaches a ref written inline in a sentence", () => {
    const doc = project('La noción de <Atom ref="a-origins/00-axioms/modelo">modelo</Atom>.\n');
    expect(Object.keys(doc.links)).toEqual(["a-origins/00-axioms/modelo"]);
  });

  it("reaches a ref nested inside an atom inside a column", () => {
    const md =
      '::::::columns{widths="1,1"}\n:::::col\n:::atom{id="a" kind="definition"}\n' +
      '<Atom ref="a-origins/00-axioms/know" />\n:::\n:::::\n:::::col\nTexto.\n:::::\n::::::\n';
    expect(Object.keys(project(md).links)).toEqual(["a-origins/00-axioms/know"]);
  });

  it("leaves out a ref that resolves to nothing rather than crashing", () => {
    const doc = project('::embed{ref="a-origins/00-axioms/no-existe"}\n\n::embed{ref="basura"}\n');
    expect(doc.links).toEqual({});
  });

  it("ships an empty table for a document that points nowhere", () => {
    expect(project("Sólo prosa.\n").links).toEqual({});
  });

  it("carries the request's own ref and href through untouched", () => {
    const s = source("Prosa.\n");
    const doc = projectPeek(s, [], { ref: "a-origins/00-axioms/data", href: "/descubre/a-origins/00-axioms/dato" });
    expect(doc).toMatchObject({
      ref: "a-origins/00-axioms/data",
      href: "/descubre/a-origins/00-axioms/dato",
      kind: "level",
      level: "data",
      translated: true,
      title: "Dato — Axiomas",
    });
  });

  it("passes an untranslated route's flag on, so the panel can say so", () => {
    const doc = project("Prosa.\n", {
      route: { kind: "atom", level: "data", locale: "en", translated: false },
    });
    expect(doc).toMatchObject({ kind: "atom", translated: false });
  });
});

/* ————————————————————————————— the stack ————————————————————————————— */

const entry = (ref: string, over: Partial<PeekEntry> = {}): PeekEntry => ({
  ...peekEntry({ ref }, "es")!,
  ...over,
});

const click = (over: Partial<ClickLike> = {}): ClickLike => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
  peekRef: "a-origins/00-axioms/data",
  linkTarget: null,
  ...over,
});

describe("peekEntry", () => {
  it("knows everything but the document before anything is fetched", () => {
    expect(peekEntry({ ref: "a-origins/00-axioms/info#el-mecanismo", label: " Mecanismo " }, "es")).toMatchObject({
      ref: "a-origins/00-axioms/info#el-mecanismo",
      targetId: "a-origins/00-axioms/info",
      url: "/peek/a-origins/00-axioms/informacion.json",
      anchor: "el-mecanismo",
      label: "Mecanismo",
      href: "/descubre/a-origins/00-axioms/informacion#el-mecanismo",
      status: "loading",
      doc: null,
    });
  });

  it("carries the locale into both URLs", () => {
    expect(peekEntry({ ref: "a-origins/00-axioms/modelo" }, "en")).toMatchObject({
      url: "/en/peek/a-origins/00-axioms/atomo/modelo.json",
      href: "/en/descubre/a-origins/00-axioms/atomo/modelo",
      anchor: null,
    });
  });

  it("is null for a ref that is not one", () => {
    expect(peekEntry({ ref: "data" }, "es")).toBeNull();
  });
});

describe("decidePeek", () => {
  it("stacks under the limit", () => {
    expect(decidePeek([], "a/b/data")).toEqual({ kind: "push" });
  });

  it("navigates instead of stacking a fifth panel", () => {
    const full = Array.from({ length: MAX_PEEK_DEPTH }, (_, i) => entry(`a-origins/0${i}-t/data`));
    expect(decidePeek(full, "a-origins/09-t/data")).toEqual({ kind: "navigate", why: "depth" });
  });

  // The loop guard: a different anchor is still the same document, so it must not stack.
  it("refuses a document already in the stack, even at another anchor", () => {
    const open = [entry("a-origins/00-axioms/info#el-mecanismo")];
    expect(decidePeek(open, "a-origins/00-axioms/info")).toEqual({ kind: "navigate", why: "cycle" });
  });

  it("navigates when the ref did not parse", () => {
    expect(decidePeek([], null)).toEqual({ kind: "navigate", why: "unparseable" });
  });
});

describe("shouldPeek", () => {
  it("claims a plain left click on a trigger", () => {
    expect(shouldPeek(click())).toBe("a-origins/00-axioms/data");
  });

  it("leaves every modified click to the browser", () => {
    for (const key of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const) {
      expect(shouldPeek(click({ [key]: true })), key).toBeNull();
    }
  });

  it("leaves middle and right clicks alone", () => {
    expect(shouldPeek(click({ button: 1 }))).toBeNull();
    expect(shouldPeek(click({ button: 2 }))).toBeNull();
  });

  it("does not fight a handler that already claimed the event", () => {
    expect(shouldPeek(click({ defaultPrevented: true }))).toBeNull();
  });

  it("lets a link that asked for a new tab have one", () => {
    expect(shouldPeek(click({ linkTarget: "_blank" }))).toBeNull();
    expect(shouldPeek(click({ linkTarget: "_self" }))).toBe("a-origins/00-axioms/data");
  });

  it("ignores a click that is not on a trigger at all", () => {
    expect(shouldPeek(click({ peekRef: null }))).toBeNull();
  });
});

describe("peekReducer", () => {
  const doc = { title: "Dato" } as unknown as PeekDoc;
  const one = entry("a-origins/00-axioms/data");

  it("pushes and truncates", () => {
    const two = peekReducer([one], { type: "push", entry: entry("a-origins/00-axioms/info") });
    expect(two).toHaveLength(2);
    expect(peekReducer(two, { type: "truncate", length: 1 })).toEqual([one]);
    expect(peekReducer(two, { type: "truncate", length: 0 })).toEqual([]);
  });

  it("ignores a truncate that would not shorten anything", () => {
    const stack = [one];
    expect(peekReducer(stack, { type: "truncate", length: 5 })).toBe(stack);
  });

  it("settles the entry the response belongs to", () => {
    expect(peekReducer([one], { type: "loaded", ref: one.ref, doc })[0]).toMatchObject({
      status: "ready",
      doc,
    });
    expect(peekReducer([one], { type: "failed", ref: one.ref })[0]).toMatchObject({
      status: "error",
      doc: null,
    });
  });

  // The stale-response guard, and the reason no AbortController is needed anywhere.
  it("drops a response for a ref that is no longer in the stack", () => {
    const stack = [entry("a-origins/00-axioms/info")];
    expect(peekReducer(stack, { type: "loaded", ref: one.ref, doc })).toBe(stack);
  });

  it("drops a second response for an entry that already settled", () => {
    const settled = peekReducer([one], { type: "loaded", ref: one.ref, doc });
    expect(peekReducer(settled, { type: "failed", ref: one.ref })).toBe(settled);
  });
});

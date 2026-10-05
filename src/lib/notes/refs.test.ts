import { describe, expect, it } from "vitest";

import { atomHref, parseRef, peekUrl, refHref, refTargetId, resolveRefIn, topicHref } from "./refs";

describe("parseRef", () => {
  it("reads a level ref", () => {
    expect(parseRef("a-origins/00-axioms/info")).toEqual({
      kind: "level",
      topic: "a-origins/00-axioms",
      level: "info",
      anchor: null,
    });
  });

  it("keeps the anchor", () => {
    expect(parseRef("a-origins/00-axioms/know#historia")).toMatchObject({ level: "know", anchor: "historia" });
  });

  it("reads an atom ref", () => {
    expect(parseRef("a-origins/00-axioms/sistema-formal")).toEqual({
      kind: "atom",
      topic: "a-origins/00-axioms",
      atomId: "sistema-formal",
    });
  });

  it("reads the tail, not the segment count, so nested topics work", () => {
    expect(parseRef("a-origins/01-mathematical-logic/00-propositional-logic/data")).toMatchObject({
      kind: "level",
      topic: "a-origins/01-mathematical-logic/00-propositional-logic",
      level: "data",
    });
  });

  it("rejects anything without a topic in front of it", () => {
    expect(parseRef("data")).toBeNull();
    expect(parseRef("")).toBeNull();
    expect(parseRef("/")).toBeNull();
  });
});

describe("refTargetId", () => {
  it("drops the anchor: only whole documents can be validated", () => {
    expect(refTargetId(parseRef("a-origins/00-axioms/info#el-mecanismo")!)).toBe("a-origins/00-axioms/info");
  });

  it("names the atom", () => {
    expect(refTargetId(parseRef("a-origins/00-axioms/modelo")!)).toBe("a-origins/00-axioms/modelo");
  });
});

describe("hrefs", () => {
  it("makes the entry level the topic URL itself", () => {
    expect(topicHref("a-origins/00-axioms", "know")).toBe("/descubre/a-origins/00-axioms");
  });

  it("uses the Spanish slug for the lower levels", () => {
    expect(topicHref("a-origins/00-axioms", "info")).toBe("/descubre/a-origins/00-axioms/informacion");
    expect(topicHref("a-origins/00-axioms", "data")).toBe("/descubre/a-origins/00-axioms/dato");
  });

  it("keeps Spanish slugs under the English prefix", () => {
    expect(topicHref("a-origins/00-axioms", "data", "en")).toBe("/en/descubre/a-origins/00-axioms/dato");
    expect(topicHref("a-origins/00-axioms", "know", "en")).toBe("/en/descubre/a-origins/00-axioms");
  });

  it("gives an atom its own page", () => {
    expect(atomHref("a-origins/00-axioms", "modelo")).toBe("/descubre/a-origins/00-axioms/atomo/modelo");
  });

  it("carries the anchor into the link", () => {
    expect(refHref(parseRef("a-origins/00-axioms/info#el-mecanismo")!)).toBe(
      "/descubre/a-origins/00-axioms/informacion#el-mecanismo",
    );
  });
});

describe("peekUrl", () => {
  const url = (raw: string, locale?: "es" | "en") => peekUrl(parseRef(raw)!, locale);

  it("mirrors the page URL under the peek section", () => {
    expect(url("a-origins/00-axioms/know")).toBe("/peek/a-origins/00-axioms.json");
    expect(url("a-origins/00-axioms/info")).toBe("/peek/a-origins/00-axioms/informacion.json");
    expect(url("a-origins/00-axioms/data")).toBe("/peek/a-origins/00-axioms/dato.json");
    expect(url("a-origins/00-axioms/sistema-formal")).toBe(
      "/peek/a-origins/00-axioms/atomo/sistema-formal.json",
    );
  });

  it("prefixes English and leaves the slugs in Spanish", () => {
    expect(url("a-origins/00-axioms/know", "en")).toBe("/en/peek/a-origins/00-axioms.json");
    expect(url("a-origins/00-axioms/data", "en")).toBe("/en/peek/a-origins/00-axioms/dato.json");
    expect(url("a-origins/00-axioms/sistema-formal", "en")).toBe(
      "/en/peek/a-origins/00-axioms/atomo/sistema-formal.json",
    );
  });

  it("never doubles a slash, even where a segment is empty", () => {
    for (const raw of ["a-origins/00-axioms/know", "a-origins/00-axioms/data"]) {
      for (const locale of ["es", "en"] as const) expect(url(raw, locale)).not.toMatch(/\/\//);
    }
  });

  it("drops the anchor: the document is what gets fetched", () => {
    expect(url("a-origins/00-axioms/info#el-mecanismo")).toBe("/peek/a-origins/00-axioms/informacion.json");
  });
});

describe("resolveRefIn", () => {
  const links = {
    "a-origins/00-axioms/info": { href: "/descubre/a-origins/00-axioms/informacion", title: "Información" },
    "a-origins/00-axioms/modelo": { href: "/descubre/a-origins/00-axioms/atomo/modelo", title: "Modelo" },
  };

  it("resolves a plain ref", () => {
    expect(resolveRefIn(links, "a-origins/00-axioms/modelo")).toEqual(links["a-origins/00-axioms/modelo"]);
  });

  // The regression: the table has no anchored keys, so `links[raw]` rendered these as dead labels.
  it("resolves an anchored ref and puts the anchor back on the href", () => {
    expect(resolveRefIn(links, "a-origins/00-axioms/info#el-mecanismo")).toEqual({
      href: "/descubre/a-origins/00-axioms/informacion#el-mecanismo",
      title: "Información",
    });
  });

  it("is null for a ref that does not parse and for one that misses", () => {
    expect(resolveRefIn(links, "info")).toBeNull();
    expect(resolveRefIn(links, "a-origins/00-axioms/no-existe")).toBeNull();
  });
});

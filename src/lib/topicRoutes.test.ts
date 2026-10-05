import { describe, expect, it } from "vitest";

import { LEVELS, LOCALES, type Locale } from "@/i18n";
import { topicRoutes, type AtomSource, type LevelSource, type TopicRoute } from "./topicRoutes";

/*
  The regression this file exists for: mathsTree.ts has always generated /en/descubre/… hrefs and,
  until the English page existed, every one of them was a 404. So the load-bearing assertion here
  is not "the Spanish routes are right" — it is "the two locales produce the same set of URLs".
*/

const TOPIC = "a-origins/00-axioms";
const OTHER = "b-pure/00-algebra";

const level = (topic: string, lang: Locale, over: Partial<LevelSource> = {}): LevelSource[] =>
  LEVELS.map((l) => ({ ref: `${topic}/${l}`, topic, level: l, lang, draft: false, ...over }));

const atom = (topic: string, localId: string, lang: Locale): AtomSource => ({
  ref: `${topic}/${localId}`,
  topic,
  localId,
  lang,
});

const source = (topics: LevelSource[], atoms: AtomSource[] = []) => ({ topics, atoms });

const slugs = (routes: TopicRoute[]) => routes.map((r) => r.slug).sort();

describe("level routes", () => {
  const routes = topicRoutes(source(level(TOPIC, "es")), "es");

  it("gives the entry level the topic URL itself", () => {
    expect(slugs(routes)).toEqual([TOPIC, `${TOPIC}/dato`, `${TOPIC}/informacion`]);
  });

  it("renders each route from its own record", () => {
    expect(routes.find((r) => r.level === "data")?.entryId).toBe(`es/${TOPIC}/data`);
  });

  it("emits no route at all for a draft", () => {
    expect(topicRoutes(source(level(TOPIC, "es", { draft: true })), "es")).toEqual([]);
  });
});

describe("atom routes", () => {
  const routes = topicRoutes(source(level(TOPIC, "es"), [atom(TOPIC, "modelo", "es")]), "es");

  it("gives an atom exactly one page", () => {
    const pages = routes.filter((r) => r.kind === "atom");
    expect(pages).toHaveLength(1);
    expect(pages[0].slug).toBe(`${TOPIC}/atomo/modelo`);
  });

  it("does not publish an atom whose topic is a draft", () => {
    const drafted = source(level(TOPIC, "es", { draft: true }), [atom(TOPIC, "modelo", "es")]);
    expect(topicRoutes(drafted, "es")).toEqual([]);
  });
});

describe("locales", () => {
  const both = source(
    [...level(TOPIC, "es"), ...level(OTHER, "es"), { ...level(TOPIC, "en")[0] }],
    [atom(TOPIC, "modelo", "es")],
  );

  it("emits the same URLs in every locale", () => {
    const [first, ...rest] = LOCALES.map((locale) => slugs(topicRoutes(both, locale)));
    for (const other of rest) expect(other).toEqual(first);
  });

  it("keeps Spanish slugs in English", () => {
    expect(slugs(topicRoutes(both, "en"))).toContain(`${TOPIC}/informacion`);
  });

  it("marks a route translated only when the locale has its own file", () => {
    const en = topicRoutes(both, "en");
    expect(en.find((r) => r.slug === TOPIC)).toMatchObject({ translated: true, entryId: `en/${TOPIC}/know` });
    expect(en.find((r) => r.slug === `${TOPIC}/dato`)).toMatchObject({
      translated: false,
      entryId: `es/${TOPIC}/data`,
    });
  });

  it("a translation adds a rendering, never a route", () => {
    const onlyEnglish = source([...level(TOPIC, "es"), ...level(OTHER, "en")]);
    expect(slugs(topicRoutes(onlyEnglish, "en")).some((s) => s.startsWith(OTHER))).toBe(false);
  });
});

describe("uniqueness", () => {
  const many = source(
    [...level(TOPIC, "es"), ...level(OTHER, "es"), ...level(TOPIC, "en")],
    [atom(TOPIC, "modelo", "es"), atom(TOPIC, "modelo", "en"), atom(OTHER, "modelo", "es")],
  );

  it("never emits the same slug twice", () => {
    for (const locale of LOCALES) {
      const all = slugs(topicRoutes(many, locale));
      expect(new Set(all).size).toBe(all.length);
    }
  });

  /*
    The peek endpoint reuses these slugs verbatim, so its files inherit this uniqueness — the
    reason it enumerates through topicPaths() instead of building a path set of its own. Note the
    shape that could have collided and does not: the Know level's slug is the topic itself, and
    every deeper page adds a segment, so `<topic>.json` and `<topic>/<x>.json` never fight.
  */
  it("derives one peek file per page, in both locales", () => {
    for (const locale of LOCALES) {
      const files = slugs(topicRoutes(many, locale)).map((slug) => `${slug}.json`);
      expect(new Set(files).size).toBe(files.length);
      expect(files).toContain(`${TOPIC}.json`);
      expect(files).toContain(`${TOPIC}/dato.json`);
      expect(files).toContain(`${TOPIC}/atomo/modelo.json`);
    }
  });

  it("gives every Spanish peek file an English twin", () => {
    const [first, ...rest] = LOCALES.map((locale) => slugs(topicRoutes(many, locale)));
    for (const other of rest) expect(other).toEqual(first);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { LEVEL_FILE } from "@/i18n";
import { parseNote, serializeNote } from "./format";
import { loadTopicIndex, MATHS_DIR } from "./loadTopics";

/*
  Law 1 of format.ts, applied to the real corpus: every tracked note is already canonical, so
  opening one in the editor and saving it produces an empty diff. This is the test that keeps the
  markdown honest — the hand-written cases in format.test.ts prove the parser can round-trip, this
  one proves the files actually do.
*/

const index = loadTopicIndex();
const noteFiles = [...new Set([...index.manifests.map((m) => m.file), ...index.topics.map((t) => t.file)])].sort();

describe("corpus", () => {
  it("finds every topic under media/maths", () => {
    expect(index.manifests.length).toBeGreaterThan(50);
    expect(noteFiles.every((f) => f.startsWith(MATHS_DIR))).toBe(true);
  });

  it.each(noteFiles)("%s round-trips byte for byte", (file) => {
    const source = readFileSync(file, "utf8");
    expect(serializeNote(parseNote(source))).toBe(source);
  });
});

describe("manifests", () => {
  const axioms = () => index.manifests.find((m) => m.topic === "a-origins/00-axioms")!;

  it("derives group and order from the path, not from frontmatter", () => {
    expect(axioms().group).toBe("a-origins");
    expect(axioms().order).toEqual([0, 0]);
  });

  it("orders nested topics by every segment", () => {
    const nested = index.manifests.find((m) => m.topic.endsWith("01-mathematical-logic/01-predicate-logic"));
    expect(nested?.order).toEqual([0, 1, 1]);
  });

  it("treats a topic as a draft unless it says otherwise", () => {
    // media/maths is also video research: publishing has to be something a file opts into, or the
    // 57 stubs turn into 57 pages the day the routes exist.
    const published = index.manifests.filter((m) => !m.draft);
    expect(published.map((m) => m.topic)).toEqual(["a-origins/00-axioms"]);
    expect(axioms().draft).toBe(false);
  });
});

describe("level files", () => {
  it("emits one record per level file that exists", () => {
    const axioms = index.topics.filter((t) => t.topic === "a-origins/00-axioms");
    expect(axioms.map((t) => t.id).sort()).toEqual([
      "es/a-origins/00-axioms/data",
      "es/a-origins/00-axioms/info",
      "es/a-origins/00-axioms/know",
    ]);
  });

  it("does not invent records for missing translations", () => {
    expect(index.topics.some((t) => t.lang === "en")).toBe(false);
  });

  it("maps each level to its numbered file", () => {
    for (const topic of index.topics) expect(topic.file.endsWith(LEVEL_FILE[topic.level])).toBe(true);
  });
});

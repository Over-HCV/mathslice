import { defineCollection, z } from "astro:content";
import type { Loader, LoaderContext } from "astro/loaders";
import { resolve } from "node:path";

import { MATHS_DIR, loadTopicIndex, type AtomRecord, type TopicIndex, type TopicRecord } from "@/lib/notes/loadTopics";
import { assertTopicIndex, formatProblems } from "@/lib/notes/validate";

/*
  Two collections, ONE pass over media/maths/. Both are views of the same TopicIndex, so an atom
  and the page it lives on can never disagree about what the file says.

  There is no schema here beyond the TypeScript type. The loader does not read loose frontmatter
  and hand it over — it builds typed records itself, so a zod object would be a second declaration
  of a shape that already exists in loadTopics.ts, drifting the first time a field is added.
  Validation that actually matters (unknown atom kinds, duplicate ids, dangling refs, cycles) is
  content-wide and lives in validate.ts, where it can see the whole tree at once.
*/

let cache: TopicIndex | null = null;

function topicIndex(logger: LoaderContext["logger"]): TopicIndex {
  if (cache) return cache;
  const index = loadTopicIndex();
  const { warnings } = assertTopicIndex(index);
  if (warnings.length) logger.warn(`Contenido:\n${formatProblems(warnings)}`);
  cache = index;
  return index;
}

/** Loaders whose watchers are already wired. `load` runs again on every refresh, and registering
 *  a second listener each time is how one saved file turns into N rebuilds. */
const watching = new Set<string>();

function mathsLoader<T extends { id: string }>(name: string, select: (index: TopicIndex) => T[]): Loader {
  return {
    name,
    load: async (context) => {
      const { store, logger, watcher, parseData } = context;

      const fill = async () => {
        store.clear();
        for (const record of select(topicIndex(logger))) {
          store.set({ id: record.id, data: await parseData({ id: record.id, data: record }) });
        }
      };

      await fill();
      if (!watcher || watching.has(name)) return;
      watching.add(name);

      // The content layer only watches src/ by default; media/ is outside it, so the base has to
      // be handed to the watcher explicitly — the same thing astro's own glob loader does.
      watcher.add(resolve(process.cwd(), MATHS_DIR));

      const reload = async (path: string) => {
        if (!path.endsWith(".md")) return;
        cache = null; // A ref crosses files, so one edit can invalidate a validation anywhere.
        try {
          await fill();
          logger.info(`Recargado ${name} tras cambiar ${path}`);
        } catch (error) {
          logger.error(error instanceof Error ? error.message : String(error));
        }
      };

      watcher.on("change", reload);
      watcher.on("add", reload);
      watcher.on("unlink", reload);
    },
  };
}

/** One level file of one topic in one language. */
const topics = defineCollection({
  loader: mathsLoader("mathslice-topics", (index) => index.topics),
  schema: z.custom<TopicRecord>(),
});

/** One `:::atom{…}`, addressable on its own. */
const atoms = defineCollection({
  loader: mathsLoader("mathslice-atoms", (index) => index.atoms),
  schema: z.custom<AtomRecord>(),
});

export const collections = { topics, atoms };

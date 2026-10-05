/*
  The peek panel's source of documents, in Spanish. Its English twin is src/pages/en/peek/.

  Same slugs as /descubre, serving JSON instead of a page, from the same enumerator — so a peek
  URL is the page URL under another section and the two cannot drift.

  The directory is `peek`, NOT `_peek`: Astro silently drops every route whose path has a segment
  starting with `_`. See PEEK_SEGMENT in src/lib/notes/refs.ts.
*/
import type { APIRoute } from "astro";

import { peekDoc, topicPaths } from "@/lib/topicPages";

export const getStaticPaths = () => topicPaths("es");

export const GET: APIRoute = async ({ props }) => Response.json(await peekDoc(props.route));

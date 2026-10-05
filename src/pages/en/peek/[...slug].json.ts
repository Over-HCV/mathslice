/* The English twin of src/pages/peek/[...slug].json.ts — see that file for why it exists. */
import type { APIRoute } from "astro";

import { peekDoc, topicPaths } from "@/lib/topicPages";

export const getStaticPaths = () => topicPaths("en");

export const GET: APIRoute = async ({ props }) => Response.json(await peekDoc(props.route));

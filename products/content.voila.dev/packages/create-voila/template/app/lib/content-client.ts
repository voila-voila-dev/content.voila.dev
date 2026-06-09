// The typed REST client, inferred from `content.config.ts` — no codegen. Every
// collection method is typed from your fields:
//
//   const page = await client.posts.list({ orderBy: "createdAt" });
//   const post = await client.posts.create({ title: "Hi", slug: "hi" });

import { makeClient } from "@voila/content/client";
import config from "../../content.config";

export const client = makeClient(config, { baseUrl: "/admin/api" });

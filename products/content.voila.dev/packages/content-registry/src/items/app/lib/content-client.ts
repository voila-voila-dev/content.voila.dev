// The typed REST client for your content, inferred from `content.config.ts` —
// no codegen. Import `client` anywhere in the app and every collection method is
// fully typed from your fields:
//
//   const page = await client.posts.list({ orderBy: "createdAt" });
//   const post = await client.posts.create({ title: "Hi", slug: "hi" });
//
// This file is yours — change the `baseUrl` if you mount the admin API
// elsewhere, or wrap `client` with your own fetch (auth headers, retries).

import { makeClient } from "@voila/content/client";
import config from "../../content.config";

export const client = makeClient(config, { baseUrl: "/admin/api" });

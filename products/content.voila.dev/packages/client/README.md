# @voila/content-client

Typed `fetch` wrapper over the `@voila/content` REST surface. Method shapes are
inferred from your `content.config.ts` — rename a field and the client updates.

```ts
import { createClient } from "@voila/content-client";
import type content from "./content.config";

export const client = createClient<typeof content>({
  baseUrl: "/admin/api",
});

const { data, nextCursor } = await client.posts.list({ limit: 10 });
const post = await client.posts.find({ id: "abc" });
const bySlug = await client.posts.findOne({ slug: "hello" });
```

Errors are thrown as `ContentClientError` instances carrying the server's `code`
discriminator (`UNKNOWN_COLLECTION`, `NOT_FOUND`, `BAD_REQUEST`, …) so callers
can branch on `err.code`.

The shape mirrors the REST endpoints shipped in M1:

- `client.<collection>.list(query?)` → `GET /:collection`
- `client.<collection>.find({ id })` → `GET /:collection/:id`
- `client.<collection>.findOne({ [field]: value })` → `GET /:collection/by/:field/:value`

Write methods, singletons, and `include` arrive with their REST counterparts in
later milestones.

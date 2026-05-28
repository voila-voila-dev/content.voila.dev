// Playground content config — wires the M0 minimal runtime.
//
// For M0 the D1 binding may not be available outside Worker context;
// use Sqlite in-memory as the local dev default. Swap to D1Live in Workers.
import { boolean, defineCollection, defineContent, string } from "@voila/content";
import { DatabaseLive } from "@voila/content-sql";
import { SqliteLive } from "@voila/content-sql/sqlite";
import { Layer } from "effect";

const posts = defineCollection({
  slug: "posts",
  label: "Posts",
  fields: {
    title: string({ min: 1, required: true }),
    published: boolean({ default: false }),
  },
});

export default defineContent({
  branding: { name: "Playground" },
  collections: [posts],
  database: DatabaseLive.pipe(Layer.provide(SqliteLive({ url: ":memory:" }))),
});

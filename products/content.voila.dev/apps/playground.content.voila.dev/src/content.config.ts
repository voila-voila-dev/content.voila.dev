// Playground content config — wires the M0 minimal runtime.
//
// M0 doesn't query the database (admin shell only renders branding), so we
// use `NoopDatabaseLive` to keep both `bun:sqlite` and the Cloudflare D1
// binding out of the Workers bundle. When the read path lands in M1, swap
// to `DatabaseLive.pipe(Layer.provide(D1Live({ binding: env.DATABASE })))`
// in the worker entry and `SqliteLive({ url: ":memory:" })` locally.
import { boolean, defineCollection, defineContent, string } from "@voila/content";
import { NoopDatabaseLive } from "@voila/content-sql";

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
  database: NoopDatabaseLive,
});

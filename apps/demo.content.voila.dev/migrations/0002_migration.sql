-- Incremental migration on top of 0001: the new `status`/`location` fields on
-- `posts`, the `settings` singleton, and the engine-owned `voila_views` store.
-- (Hand-authored as a delta — `voila migrate generate` emits a full snapshot,
-- which would fail re-CREATE-ing the tables 0001 already created.)

ALTER TABLE "posts" ADD COLUMN "status" TEXT;
ALTER TABLE "posts" ADD COLUMN "location" TEXT;

CREATE TABLE IF NOT EXISTS "settings" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "deleted_at" INTEGER,
  "site_name" TEXT NOT NULL,
  "tagline" TEXT,
  "contact_email" TEXT,
  CHECK ("id" = 'settings')
);

CREATE TABLE IF NOT EXISTS "voila_views" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "collection" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "config" TEXT NOT NULL,
  "is_default" INTEGER NOT NULL DEFAULT 0,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS "voila_views_owner_collection_idx" ON "voila_views" ("owner_id", "collection");

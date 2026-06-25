CREATE TABLE "everything" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "deleted_at" INTEGER,
  "title" TEXT NOT NULL,
  "title_localized" TEXT,
  "count" INTEGER NOT NULL,
  "weight" REAL,
  "is_published" INTEGER NOT NULL,
  "published_date" TEXT,
  "published_at" INTEGER NOT NULL,
  "schedule" TEXT,
  "runtime" INTEGER,
  "slug" TEXT,
  "status" TEXT NOT NULL,
  "tags" TEXT,
  "role" TEXT,
  "primary_color" TEXT,
  "body" TEXT,
  "snippet" TEXT,
  "secret_token" TEXT,
  "password_hash" TEXT,
  "metadata" TEXT,
  "sections" TEXT,
  "seo" TEXT,
  "cover" TEXT,
  "blocks" TEXT,
  "related" TEXT,
  "author_id" TEXT,
  "contributors" TEXT,
  "sort_key" REAL
);
CREATE UNIQUE INDEX "everything_slug_unique_idx" ON "everything" ("slug");

CREATE TABLE "settings" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "deleted_at" INTEGER,
  "site_name" TEXT,
  "primary_color" TEXT,
  CHECK ("id" = 'settings')
);

CREATE TABLE "voila_media" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "key" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "alt" TEXT,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX "voila_media_key_unique_idx" ON "voila_media" ("key");

CREATE TABLE "voila_views" (
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
CREATE INDEX "voila_views_owner_collection_idx" ON "voila_views" ("owner_id", "collection");

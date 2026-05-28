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
  "runtime" TEXT,
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

CREATE TABLE "everything" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ,
  "title" TEXT NOT NULL,
  "title_localized" JSONB,
  "count" BIGINT NOT NULL,
  "weight" DOUBLE PRECISION,
  "is_published" BOOLEAN NOT NULL,
  "published_date" DATE,
  "published_at" TIMESTAMPTZ NOT NULL,
  "schedule" TIME,
  "runtime" BIGINT,
  "slug" TEXT,
  "status" TEXT NOT NULL,
  "tags" JSONB,
  "role" TEXT,
  "primary_color" TEXT,
  "body" TEXT,
  "snippet" TEXT,
  "secret_token" TEXT,
  "password_hash" TEXT,
  "metadata" JSONB,
  "sections" JSONB,
  "seo" JSONB,
  "cover" JSONB,
  "blocks" JSONB,
  "related" JSONB,
  "author_id" TEXT,
  "contributors" JSONB,
  "sort_key" DOUBLE PRECISION
);
CREATE UNIQUE INDEX "everything_slug_unique_idx" ON "everything" ("slug");

CREATE TABLE "settings" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ,
  "site_name" JSONB,
  "primary_color" TEXT,
  CHECK ("id" = 'settings')
);

CREATE TABLE "voila_media" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "key" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "size" BIGINT NOT NULL,
  "width" BIGINT,
  "height" BIGINT,
  "alt" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "voila_media_key_unique_idx" ON "voila_media" ("key");

CREATE TABLE "voila_views" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "collection" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "position" BIGINT NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "voila_views_owner_collection_idx" ON "voila_views" ("owner_id", "collection");

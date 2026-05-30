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

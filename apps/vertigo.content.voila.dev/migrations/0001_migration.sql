CREATE TABLE "films" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "deleted_at" INTEGER,
  "title" TEXT NOT NULL,
  "slug" TEXT,
  "original_title" TEXT,
  "synopsis" TEXT,
  "notes" TEXT,
  "poster" TEXT,
  "still" TEXT,
  "director" TEXT,
  "year" INTEGER,
  "runtime" INTEGER,
  "country" TEXT,
  "formats" TEXT,
  "certificate" TEXT,
  "status" TEXT,
  "featured" INTEGER,
  "accent_color" TEXT,
  "shot_in" TEXT,
  "trailer_url" TEXT
);
CREATE UNIQUE INDEX "films_slug_unique_idx" ON "films" ("slug");

CREATE TABLE "screenings" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "deleted_at" INTEGER,
  "label" TEXT NOT NULL,
  "film" TEXT,
  "starts_at" INTEGER,
  "ends_at" INTEGER,
  "screen" TEXT,
  "presentation" TEXT,
  "host" TEXT,
  "status" TEXT,
  "sold_out" INTEGER,
  "ticket_url" TEXT,
  "note" TEXT
);

CREATE TABLE "people" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "deleted_at" INTEGER,
  "name" TEXT NOT NULL,
  "slug" TEXT,
  "role" TEXT,
  "portrait" TEXT,
  "bio" TEXT,
  "born_in" TEXT,
  "website" TEXT
);
CREATE UNIQUE INDEX "people_slug_unique_idx" ON "people" ("slug");

CREATE TABLE "journal" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "deleted_at" INTEGER,
  "title" TEXT NOT NULL,
  "slug" TEXT,
  "excerpt" TEXT,
  "body" TEXT,
  "cover" TEXT,
  "author" TEXT,
  "about_film" TEXT,
  "tags" TEXT,
  "status" TEXT,
  "published_at" INTEGER
);
CREATE UNIQUE INDEX "journal_slug_unique_idx" ON "journal" ("slug");

CREATE TABLE "settings" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "deleted_at" INTEGER,
  "site_name" TEXT NOT NULL,
  "tagline" TEXT,
  "about" TEXT,
  "logo" TEXT,
  "primary_color" TEXT,
  "address" TEXT,
  "location" TEXT,
  "opening_hours" TEXT,
  "contact_email" TEXT,
  "instagram" TEXT,
  CHECK ("id" = 'settings')
);

CREATE TABLE "voila_revisions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "collection" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "rev" INTEGER NOT NULL,
  "data" TEXT NOT NULL,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX "voila_revisions_doc_rev_unique_idx" ON "voila_revisions" ("collection", "document_id", "rev");

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
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX "voila_views_owner_collection_idx" ON "voila_views" ("owner_id", "collection");

CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text,
  "email" text NOT NULL UNIQUE,
  "emailVerified" integer DEFAULT 0 NOT NULL,
  "image" text,
  "createdAt" integer NOT NULL,
  "updatedAt" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "expiresAt" integer NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "createdAt" integer NOT NULL,
  "updatedAt" integer NOT NULL
);

CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");

CREATE INDEX IF NOT EXISTS "session_expiresAt_idx" ON "session" ("expiresAt");

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" integer,
  "refreshTokenExpiresAt" integer,
  "scope" text,
  "password" text,
  "createdAt" integer NOT NULL,
  "updatedAt" integer NOT NULL
);

CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "account_provider_account_idx" ON "account" ("providerId", "accountId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" integer NOT NULL,
  "createdAt" integer NOT NULL,
  "updatedAt" integer NOT NULL
);

CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

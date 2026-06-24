CREATE TABLE "posts" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "deleted_at" INTEGER,
  "title" TEXT NOT NULL,
  "slug" TEXT,
  "cover_image" TEXT,
  "body" TEXT,
  "content" TEXT,
  "summary" TEXT,
  "published" INTEGER,
  "published_at" INTEGER
);
CREATE UNIQUE INDEX "posts_slug_unique_idx" ON "posts" ("slug");

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

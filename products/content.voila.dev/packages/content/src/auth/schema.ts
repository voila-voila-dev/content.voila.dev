// DDL for the four Better Auth core tables (SQLite/D1). Dates are stored as
// epoch-ms `INTEGER` and booleans as `0/1` — the representation the SqlClient
// adapter (`./adapter`) converts to/from. Shipped here so `voila migrate`
// provisions auth tables alongside the collection schema, and so tests can
// create them on the same in-memory connection the adapter uses.

/** The auth tables, as individual `CREATE` statements (run each separately). */
export const authTableStatements: ReadonlyArray<string> = [
  `CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text,
  "email" text NOT NULL UNIQUE,
  "emailVerified" integer DEFAULT 0 NOT NULL,
  "image" text,
  "createdAt" integer NOT NULL,
  "updatedAt" integer NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "expiresAt" integer NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "createdAt" integer NOT NULL,
  "updatedAt" integer NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId")`,
  `CREATE INDEX IF NOT EXISTS "session_expiresAt_idx" ON "session" ("expiresAt")`,
  `CREATE TABLE IF NOT EXISTS "account" (
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
)`,
  `CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "account_provider_account_idx" ON "account" ("providerId", "accountId")`,
  `CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" integer NOT NULL,
  "createdAt" integer NOT NULL,
  "updatedAt" integer NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier")`,
];

/** The auth DDL as a single migration-ready SQL string. */
export const authTablesSql: string = `${authTableStatements.join(";\n\n")};\n`;

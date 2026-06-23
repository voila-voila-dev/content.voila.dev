// DDL for the four Better Auth core tables (SQLite/D1). Dates are stored as
// epoch-ms `INTEGER` and booleans as `0/1` — the representation the SQL adapter
// (`server/auth/better-auth/adapter`) converts to and from. It lives in the
// dependency-free `sql` package (not the auth layer) so the CLI can fold it into
// `voila migrate generate --auth` and tests can create the tables on the same
// in-memory connection the adapter uses — neither pulls in `better-auth`.

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

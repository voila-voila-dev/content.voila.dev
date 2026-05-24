/**
 * Drizzle schema for the four better-auth tables (`user`, `session`,
 * `account`, `verification`). Better Auth's built-in CLI generates the same
 * shapes; we vendor them so the schema lives next to the migration that
 * provisions it and so consumers don't need to run a second codegen step.
 *
 * Two dialects are exported: `sqlite` (D1 + local SQLite) is used today,
 * `pg` is published now so the M2 Postgres adapter has a place to land
 * without a breaking export change.
 */

import { integer, type SQLiteTableWithColumns, sqliteTable, text } from "drizzle-orm/sqlite-core";

// `drizzleAdapter` only inspects the table object structurally, so the
// loose `unknown` slot below keeps the public type from leaking drizzle's
// internal column shapes through `isolatedDeclarations` while still
// keeping each export referenceable from user code.
type AnySqliteTable = SQLiteTableWithColumns<{
  name: string;
  schema: string | undefined;
  dialect: "sqlite";
  // biome-ignore lint/suspicious/noExplicitAny: column shapes are not part of the public surface; consumers reference the tables by reference.
  columns: any;
}>;

/** Better Auth `user` table (SQLite). */
export const sqliteUser: AnySqliteTable = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});

/** Better Auth `session` table (SQLite). */
export const sqliteSession: AnySqliteTable = sqliteTable("session", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => sqliteUser.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});

/** Better Auth `account` table (SQLite). Used for credential + social providers. */
export const sqliteAccount: AnySqliteTable = sqliteTable("account", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => sqliteUser.id, { onDelete: "cascade" }),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp_ms" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp_ms" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});

/** Better Auth `verification` table (SQLite). Holds short-lived magic-link tokens. */
export const sqliteVerification: AnySqliteTable = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});

/**
 * SQLite schema record handed to better-auth's drizzle adapter. Keys are
 * singular by convention (`user`, not `users`); better-auth's `usePlural`
 * option is left at its default `false`.
 */
export interface SqliteAuthSchema {
  readonly user: AnySqliteTable;
  readonly session: AnySqliteTable;
  readonly account: AnySqliteTable;
  readonly verification: AnySqliteTable;
}

export const sqliteSchema: SqliteAuthSchema = {
  user: sqliteUser,
  session: sqliteSession,
  account: sqliteAccount,
  verification: sqliteVerification,
};

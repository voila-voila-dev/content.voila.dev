/**
 * Migration manifest. The CLI consumes this to copy the bundled DDL into the
 * consumer's `migrations/` directory next to the user-generated schema
 * migration, so `voila migrate apply` runs both in one shot.
 *
 * Filenames are returned as relative paths so the CLI can resolve them
 * against the package's installed location with `import.meta.resolve` /
 * `require.resolve`.
 */

export const AUTH_MIGRATIONS = {
  sqlite: "0000_auth_init.sqlite.sql",
  postgres: "0000_auth_init.postgres.sql",
} as const;

export type AuthMigrationDialect = keyof typeof AUTH_MIGRATIONS;

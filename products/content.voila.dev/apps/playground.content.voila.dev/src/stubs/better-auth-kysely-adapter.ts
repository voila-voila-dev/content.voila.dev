// Build stub for `@better-auth/kysely-adapter` (aliased in `vite.config.ts`).
//
// The engine bridges Better Auth over its own `@effect/sql` `SqlClient` with a
// custom `createAdapter` (see `@voila/content/auth`), so Better Auth never builds
// a Kysely adapter — `createKyselyAdapter`/`kyselyAdapter` are dead code, and
// `getKyselyDatabaseType` is only called as `… || "unknown"`. But the real module
// statically imports `DEFAULT_MIGRATION_TABLE`/`DEFAULT_MIGRATION_LOCK_TABLE` from
// `kysely`, which the installed kysely no longer exports — breaking the bundle.
// This benign stub keeps the (unused) imports resolvable.

export const getKyselyDatabaseType = (): null => null;

export const createKyselyAdapter = async (): Promise<{ kysely: null; databaseType: null }> => ({
  kysely: null,
  databaseType: null,
});

export const kyselyAdapter = () => () => {
  throw new Error(
    "@better-auth/kysely-adapter is stubbed — the engine uses a custom SqlClient adapter.",
  );
};

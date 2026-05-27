# @voila/content-cli

> The `voila` binary: database operations, registry management, i18n message sync,
> and developer utilities. **World:** Tooling. **Status:** Effect pivot target.

## Responsibility

Owns the `voila` binary entry point and every user-facing subcommand.
Does **not** own business logic — delegates to `@voila/content-sql` (migrations),
`@voila/content-registry` (add/diff/list), and `@voila/content-mcp` (mcp serve).
Owns the **Paraglide/Inlang message sync** `Service` (`I18n`, `InlangLive`) and its
`voila i18n` subcommands — there is no standalone i18n package.
Does not ship React or Effect runtime code into the consumer app.

## Public API / Commands

```
voila migrate generate   [--name <slug>] [--dialect sqlite|postgres]
voila migrate apply      [--target sqlite|postgres|d1-local|d1-remote] [--db <url>]
voila migrate install-auth
voila seed admin         --email <addr> [--name <name>]
voila doctor             # validate content.config + reachable db + missing env vars
voila mcp                # start MCP server (delegates to @voila/content-mcp)

# i18n message sync — Paraglide/Inlang integration
voila i18n pull          # pull translations from Inlang, write Paraglide source
voila i18n push          # push extracted message keys to Inlang (no deletion)
voila i18n sync          # extract keys + push to Inlang + pull Paraglide source
voila i18n status        # show key counts and locale coverage

# Registry commands (replace the virtual vite plugin)
voila add <item>         # resolve deps, copy source into consumer app/
voila diff [<item>]      # show drift between vended copy and upstream
voila list               # catalog of available registry items
voila add <item> --eject-server   # additionally vend HttpApi + handlers (opt-in B path)
```

## How it works

Built on **`@effect/cli`** (`Command`, `Args`, `Options`). Each subcommand is an
`Effect` program; the binary entry point runs them via `Effect.runPromise` with
the appropriate `Layer`s (e.g. `NodeFileSystem`, `NodeCommandExecutor`).

The hand-rolled `parseFlags` loop and `run(argv)` dispatcher from the current
tree are replaced by `@effect/cli`'s declarative `Command.make` tree, which
gives `--help`, autocomplete, and typed options for free.

```ts
// conceptual — illustrates @effect/cli shape
const migrateApply = Command.make("apply", {
  target: Options.choice("target", ["sqlite", "postgres", "d1-local", "d1-remote"]),
  db:     Options.optional(Options.text("db")),
}).pipe(
  Command.withHandler(({ target, db }) =>
    Effect.serviceWith(MigratorService, (m) => m.apply({ target, db }))
  )
)
```

Error messages from Effect failures are formatted by `@effect/cli`'s built-in
error renderer; the `--help` output derives from `Command` annotations.

## i18n message sync (`voila i18n`)

The Paraglide/Inlang integration lives here, not in a separate package. Locale
types and localized-field storage shape are owned by `@voila/content`; this
package owns the build-time sync Service that keeps Inlang translation files in
step with the content schema's string fields.

### `I18n` Service

```ts
// Internal Service (not a public npm export — consumed by voila i18n commands)
interface I18n {
  // Extract translatable message keys from field annotations
  extractKeys(config: ContentConfig): Effect.Effect<MessageKey[]>
  // Push extracted keys to Inlang project (creates missing, no deletion)
  push(keys: MessageKey[]): Effect.Effect<SyncResult, I18nError>
  // Pull translations from Inlang, write Paraglide output files
  pull(): Effect.Effect<void, I18nError>
  // Convenience: extract + push + pull in one pass
  sync(config: ContentConfig): Effect.Effect<SyncResult, I18nError>
}

interface MessageKey {
  id: string               // e.g. "voila.posts.title.label"
  defaultMessage: string
  description?: string
}

interface SyncResult {
  added: string[]
  skipped: string[]
  written: string[]        // Paraglide output files updated
}
```

`InlangLive` is the default `Layer`; it reads/writes an Inlang project directory
using `@effect/platform` `FileSystem` and `HttpClient` (for remote Inlang cloud).
Key extraction walks `VoilaField` annotations from `@voila/content-schema`.

**Locale types** (`Locale`, `InferLocalized`) come from `@voila/content-schema` and
are re-exported from `@voila/content`. This package imports them but does not define them.

### Usage

```bash
# Most common — run in CI or as a pre-build step
voila i18n sync

# After translators update Inlang
voila i18n pull

# Preview what keys would be emitted without writing
voila i18n push --dry-run

# Show key counts and locale coverage
voila i18n status
```

Configured via `content.config.ts`:

```ts
export default defineContent({
  // …
  i18n: {
    projectPath: "./.inlang",
    locales: ["en", "fr", "de"],
    defaultLocale: "en",
  },
})
```

## Dependencies

- `@effect/cli` — command / args / options / help
- `@effect/platform-node` — `NodeFileSystem`, `NodeCommandExecutor`
- `@effect/platform` — `FileSystem`, `HttpClient` (i18n sync)
- `effect` — `Effect`, `Layer`, `Option`
- `@voila/content-schema` — `VoilaField` annotation, `Locale` type (for key extraction)
- `@voila/content-sql` — `MigratorService` (used by migrate commands)
- `@voila/content-registry` — registry resolution (used by add/diff/list)
- `@voila/content-mcp` — `McpServer` (used by mcp command)

Paraglide and Inlang are **peer dependencies** (CLI tools / build-time only; not bundled).

## Usage

```bash
# First time setup
voila migrate apply --target d1-local

# Add the full admin shell into your app
voila add admin-shell

# Add a single table view (resolves data-table dep automatically)
voila add posts-table

# See what's drifted from upstream
voila diff

# Power-user: also vend the HttpApi + handlers (opt-in only)
voila add admin-shell --eject-server
```

## Replaces

- The current `@voila/content-cli` (`packages/cli/`) hand-rolled dispatcher
  (`run.ts`, `parseFlags`) — rebuilt on `@effect/cli`.
- Commands currently calling into Drizzle / drizzle-kit — replaced by
  `@voila/content-sql` Migrator (`@effect/sql/Migrator`).
- The route-generation responsibility of the `voila()` vite plugin (`vite.ts`)
  — replaced by `voila add` copying real files.
- The planned standalone i18n package — message sync folds into
  `@voila/content-cli`; locale types live in `@voila/content-schema` /
  `@voila/content`.

## Testing

Unit: `Effect.runPromise` with in-memory `Layer` stubs for `MigratorService`,
`RegistryService`, `I18n`; assert `Exit` shape and stdout lines.

Integration: Bun subprocess — `bun voila migrate generate` against a
temp SQLite file; snapshot the generated SQL. `voila i18n sync` against a
temp Inlang project directory; assert output files written. Mirrors the current
`migrate-generate.test.ts` / `migrate-apply.test.ts` approach, ported to
Effect-layer mocking.

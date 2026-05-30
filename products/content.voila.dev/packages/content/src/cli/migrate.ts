// `voila migrate` — the `generate` and `apply` subcommands, built on
// `@effect/cli`. Business logic lives in `../sql/migrator`; this file only wires
// options to those Effects.

import { Command, Options } from "@effect/cli";
import { Console, Effect, Option } from "effect";
import { applyD1, applySqlite } from "../sql/migrator/apply";
import { generateMigration } from "../sql/migrator/generate";
import { loadConfig } from "./config";

const configOption = Options.text("config").pipe(
  Options.withDefault("content.config.ts"),
  Options.withDescription("Path to the content config module."),
);

const dirOption = Options.text("dir").pipe(
  Options.withDefault("migrations"),
  Options.withDescription("Directory holding the .sql migration files."),
);

const generate = Command.make(
  "generate",
  {
    config: configOption,
    dir: dirOption,
    name: Options.text("name").pipe(
      Options.withDefault("migration"),
      Options.withDescription("Migration name (slugified into the filename)."),
    ),
    dialect: Options.choice("dialect", ["sqlite", "postgres"]).pipe(
      Options.withDefault("sqlite"),
      Options.withDescription("SQL dialect to render. D1 uses sqlite."),
    ),
    auth: Options.boolean("auth").pipe(
      Options.withDefault(true),
      Options.withDescription(
        "Include the Better Auth core tables (sqlite/d1 only). Use --no-auth to omit.",
      ),
    ),
  },
  ({ auth, config, dialect, dir, name }) =>
    Effect.gen(function* () {
      const normalized = yield* loadConfig(config);
      const path = yield* generateMigration({
        config: normalized,
        dir,
        name,
        dialect,
        includeAuth: auth,
      });
      yield* Console.log(`Created ${path}`);
      if (auth && dialect === "postgres") {
        yield* Console.log(
          "Note: auth tables were not included — Postgres auth DDL lands in M2 (sqlite/d1 only).",
        );
      }
    }),
).pipe(Command.withDescription("Generate a migration from the content config."));

const apply = Command.make(
  "apply",
  {
    dir: dirOption,
    target: Options.choice("target", ["sqlite", "d1-local", "d1-remote"]).pipe(
      Options.withDefault("sqlite"),
      Options.withDescription("Where to apply migrations."),
    ),
    db: Options.optional(Options.text("db")).pipe(
      Options.withDescription(
        "sqlite: database URL (default file:./local.db). d1: database name/binding (required).",
      ),
    ),
  },
  ({ db, dir, target }) =>
    target === "sqlite"
      ? Effect.gen(function* () {
          const url = Option.getOrElse(db, () => "file:./local.db");
          const applied = yield* applySqlite({ dir, url });
          yield* Console.log(
            applied.length === 0
              ? "Already up to date."
              : `Applied ${applied.length} migration(s): ${applied
                  .map(([id, name]) => `${id}_${name}`)
                  .join(", ")}`,
          );
        })
      : Effect.gen(function* () {
          const database = yield* Option.match(db, {
            onNone: () =>
              Effect.dieMessage(
                `--db <database> is required for target '${target}' (the D1 database name or binding).`,
              ),
            onSome: Effect.succeed,
          });
          yield* applyD1({ database, target });
          yield* Console.log(`Applied migrations to ${target} (${database}).`);
        }),
).pipe(Command.withDescription("Apply pending migrations to a target."));

export const migrate = Command.make("migrate").pipe(
  Command.withDescription("Database migration commands."),
  Command.withSubcommands([generate, apply]),
);

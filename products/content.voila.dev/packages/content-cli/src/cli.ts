// `voila` CLI — composition root.
//
// Builds the `Command` tree (`voila` + subcommands) and the runner the
// binary calls with `process.argv`. Per the canon, the binary is
// `@effect/platform-bun`-backed (see `bin/voila.ts`) and provides
// `BunContext.layer` so `FileSystem`/`Path` resolve.
//
// Design: docs/pivot/packages/content-cli.md.
import { Command } from "@effect/cli";
import type { FileSystem, Path, Terminal } from "@effect/platform";
import type { Effect } from "effect";
import { addCommand } from "./commands/add.ts";
import { doctorCommand } from "./commands/doctor.ts";
import { listCommand } from "./commands/list.ts";

const rootDescriptor = Command.make("voila").pipe(
  Command.withDescription("voila — headless CMS toolchain (engine + registry)"),
);

const root = rootDescriptor.pipe(Command.withSubcommands([listCommand, doctorCommand, addCommand]));

/**
 * Run the CLI with the given argv (full argv including `node`/`bun` and
 * script path — `@effect/cli`'s `Command.run` strips the first two).
 *
 * Returns an `Effect` that requires `FileSystem` + `Path` from the
 * platform layer (provided by `BunContext.layer` at the bin entry).
 */
export const cli: (
  argv: ReadonlyArray<string>,
) => Effect.Effect<void, unknown, FileSystem.FileSystem | Path.Path | Terminal.Terminal> =
  Command.run(root, {
    name: "voila",
    version: "0.1.0",
  });

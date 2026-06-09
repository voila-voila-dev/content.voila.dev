// The `voila` command dispatcher. The binary entry point (`bin.ts`) calls
// `run(process.argv.slice(2))`; each top-level command parses its own flags with
// `node:util` `parseArgs`.

import { runMigrate } from "./migrate";
import { runAdd, runDiff, runList } from "./registry";

/** A user-facing CLI failure — `bin.ts` prints the message and exits non-zero. */
export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

const HELP = `Voila content CLI

Usage: voila <command>

Commands:
  list               Browse the registry catalog of vendable items.
  add <item...>      Vend registry items (and their deps) into the app.
  diff [item...]     Show drift between your vended copy and upstream.
  migrate generate   Generate a migration from the content config.
  migrate apply      Apply pending migrations to a target.

Run "voila migrate <command> --help" for command options.`;

export async function run(argv: ReadonlyArray<string>): Promise<void> {
  const [command, ...rest] = argv;
  switch (command) {
    case "list":
      return runList(rest);
    case "add":
      return runAdd(rest);
    case "diff":
      return runDiff(rest);
    case "migrate":
      return runMigrate(rest);
    case undefined:
    case "-h":
    case "--help":
      console.log(HELP);
      return;
    default:
      throw new CliError(`Unknown command: ${command}. Run "voila --help".`);
  }
}

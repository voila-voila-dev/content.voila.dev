// The `voila` command dispatcher. The binary entry point (`bin.ts`) calls
// `run(process.argv.slice(2))`; each top-level command parses its own flags with
// `node:util` `parseArgs`.

import { runMigrate } from "./migrate";

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
  migrate generate   Generate a migration from the content config.
  migrate apply      Apply pending migrations to a target.

Run "voila migrate --help" for a command's options.`;

export async function run(argv: ReadonlyArray<string>): Promise<void> {
  const [command, ...rest] = argv;
  switch (command) {
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

// The `voila` command tree. The binary entry point (`bin.ts`) wires this to
// `Command.run` under the Bun platform layer.

import { Command } from "@effect/cli";
import { migrate } from "./migrate";

export const voila = Command.make("voila").pipe(
  Command.withDescription("Voila content CLI."),
  Command.withSubcommands([migrate]),
);

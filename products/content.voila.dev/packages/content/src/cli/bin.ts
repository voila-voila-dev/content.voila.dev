#!/usr/bin/env bun
// `voila` binary entry point. Runs the command tree under the Bun platform
// layer (FileSystem, Path, CommandExecutor) via `BunRuntime.runMain`, which
// renders failures and sets the process exit code.

import { Command } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { voila } from "./index";

const run = Command.run(voila, {
  name: "Voila content CLI",
  version: "0.1.0",
});

run(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain);

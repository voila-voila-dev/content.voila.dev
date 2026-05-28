#!/usr/bin/env bun
// `voila` binary entry point. Runs the @effect/cli command tree on the Bun
// platform — provides `BunContext.layer` so `FileSystem`/`Path`/`Terminal`
// resolve, and uses `BunRuntime.runMain` for signal handling + exit codes.
//
// Design: docs/pivot/packages/content-cli.md.
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { cli } from "../cli.ts";

cli(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain);

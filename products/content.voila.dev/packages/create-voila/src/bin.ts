#!/usr/bin/env bun
// `create-voila` binary entry point. Parses argv and runs; prints the error
// message and exits non-zero on failure.

import { run } from "./index";

run(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

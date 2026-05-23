#!/usr/bin/env bun
import { run } from "../src/run.ts";

const code = await run(process.argv.slice(2));
process.exit(code);

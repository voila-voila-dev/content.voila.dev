// `voila doctor` — validate the consumer's repo is set up for voila.
//
// M0 scope: verify a `content.config.{ts,js,mjs,cjs}` exists at the cwd and
// that the `effect` package is resolvable. Print a summary; exit non-zero
// on any failure so CI can gate on it.
//
// Full doctor surface (env vars, reachable DB) lands in M1+.
import { Command, Options } from "@effect/cli";
import { FileSystem, Path } from "@effect/platform";
import { Effect } from "effect";

const CONFIG_CANDIDATES: ReadonlyArray<string> = [
  "content.config.ts",
  "content.config.js",
  "content.config.mjs",
  "content.config.cjs",
] as const;

/**
 * Outcome of a single check. `ok` controls the exit code: any `false`
 * makes the program fail.
 */
export interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

const findConfig = (
  cwd: string,
): Effect.Effect<string | null, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    for (const candidate of CONFIG_CANDIDATES) {
      const full = path.join(cwd, candidate);
      const exists = yield* fs.exists(full).pipe(Effect.orElseSucceed(() => false));
      if (exists) return full;
    }
    return null;
  });

const checkEffectInstalled = (): Effect.Effect<boolean> =>
  Effect.sync(() => {
    try {
      // `import.meta.resolve` is sync in Bun and resolves against this module.
      // If `effect` is not installed for this package (or its consumer), this
      // throws — we coerce that into `false`.
      import.meta.resolve("effect");
      return true;
    } catch {
      return false;
    }
  });

/**
 * Run the doctor checks for `cwd`. Returns the list of results; the caller
 * (the command handler) is responsible for printing and failing.
 */
export const runChecks = (
  cwd: string,
): Effect.Effect<ReadonlyArray<CheckResult>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const configPath = yield* findConfig(cwd);
    const effectOk = yield* checkEffectInstalled();
    const results: ReadonlyArray<CheckResult> = [
      {
        name: "content.config",
        ok: configPath !== null,
        detail:
          configPath !== null
            ? `found ${configPath}`
            : `missing — expected one of: ${CONFIG_CANDIDATES.join(", ")} in ${cwd}`,
      },
      {
        name: "effect",
        ok: effectOk,
        detail: effectOk ? "installed" : "not resolvable — install `effect` as a dependency",
      },
    ];
    return results;
  });

/**
 * Error tag emitted when doctor finds any failing check. Carries the
 * full result list so callers can render the summary themselves.
 */
export class DoctorFailed extends Error {
  override readonly name: "DoctorFailed" = "DoctorFailed";
  readonly results: ReadonlyArray<CheckResult>;
  constructor(results: ReadonlyArray<CheckResult>) {
    super("voila doctor: one or more checks failed");
    this.results = results;
  }
}

/**
 * The `voila doctor` Effect: run checks, print results, fail if any
 * check failed (so `@effect/cli` returns a non-zero exit code).
 */
export const doctorProgram = (
  cwd: string,
): Effect.Effect<void, DoctorFailed, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const results = yield* runChecks(cwd);
    for (const r of results) {
      const mark = r.ok ? "OK  " : "FAIL";
      console.log(`${mark}  ${r.name}: ${r.detail}`);
    }
    const failed = results.some((r) => !r.ok);
    if (failed) {
      yield* Effect.fail(new DoctorFailed(results));
    }
  });

/**
 * `voila doctor [--cwd <path>]` command descriptor.
 */
export const doctorCommand: Command.Command<
  "doctor",
  FileSystem.FileSystem | Path.Path,
  DoctorFailed,
  { readonly cwd: string }
> = Command.make(
  "doctor",
  {
    cwd: Options.directory("cwd", { exists: "either" }).pipe(Options.withDefault(process.cwd())),
  },
  ({ cwd }) => doctorProgram(cwd),
).pipe(
  Command.withDescription(
    "Validate the current project is set up for voila (content.config + effect)",
  ),
);

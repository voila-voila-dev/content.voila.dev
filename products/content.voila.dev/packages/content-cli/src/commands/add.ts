// `voila add <item> [--cwd <path>]` — copy a registry item's files into the
// consumer's app, resolving `registryDeps` transitively.
//
// M0 scope per docs/pivot/packages/content-cli.md §"Registry commands":
//   - Resolve via `@voila/content-registry`'s `resolveItems`.
//   - Copy each file from `<registrySource>/<file.path>` to `<cwd>/<file.target>`.
//   - If the target exists with identical bytes: log "unchanged".
//   - If the target exists with different bytes: log "skip (drift)" — never
//     overwrite. (`--force` lands post-M0.)
//   - Otherwise: create parent dirs, write the file, log "wrote".
//
// File I/O goes through `@effect/platform` `FileSystem` (provided by
// `BunContext.layer` at the binary entry and in tests) so the command stays
// platform-portable — no `node:fs` calls here.

import { fileURLToPath } from "node:url";
import { Args, Command, Options } from "@effect/cli";
import { FileSystem, Path } from "@effect/platform";
import { type RegistryManifest, registryManifestUrl, resolveItems } from "@voila/content-registry";
import type { Cause } from "effect";
import { Data, Effect } from "effect";
import { loadManifest } from "./list.ts";

/**
 * Codes distinguishing the `AddError` failure modes (also used for
 * exit-code mapping):
 *   - "UNKNOWN_ITEM":   the requested item is not in the manifest.
 *   - "MISSING_SOURCE": the registry source file referenced by the manifest
 *                       does not exist on disk.
 *   - "WRITE_FAILED":   the underlying filesystem write failed.
 */
export type AddErrorCode = "UNKNOWN_ITEM" | "MISSING_SOURCE" | "WRITE_FAILED";

// `Data.TaggedError` returns an anonymous class; capture it in a named
// type so the `extends` clause is compatible with --isolatedDeclarations.
type AddErrorBase = new (args: {
  readonly code: AddErrorCode;
  readonly message: string;
}) => Cause.YieldableError & {
  readonly _tag: "AddError";
  readonly code: AddErrorCode;
  readonly message: string;
};
const AddErrorBase: AddErrorBase = Data.TaggedError("AddError")<{
  code: AddErrorCode;
  message: string;
}>;

/**
 * Tagged error for `voila add`.
 */
export class AddError extends AddErrorBase {}

/**
 * Per-file outcome of a copy. Returned (alongside being logged) so tests
 * can assert on intent without re-reading stdout.
 */
export interface CopyOutcome {
  readonly source: string;
  readonly target: string;
  readonly status: "wrote" | "unchanged" | "skip-drift";
}

/**
 * The package root of `@voila/content-registry` — the directory `file.path`
 * entries in `registry.json` resolve against. We derive it from the
 * exported `registryManifestUrl` so it Just Works no matter where the
 * package is installed (workspace symlink, hoisted node_modules, etc.).
 */
export const defaultRegistrySourceRoot = (): string =>
  fileURLToPath(new URL(".", registryManifestUrl));

const describe = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

const wrapFsError =
  (code: AddErrorCode, prefix: string) =>
  (cause: unknown): AddError =>
    new AddError({ code, message: `${prefix}: ${describe(cause)}` });

/**
 * Pure copy step — exposed so tests can drive it with a fake source root
 * and fake manifest without spawning the binary.
 *
 * `sourceRoot` is the directory `file.path` resolves against (typically the
 * `@voila/content-registry` package root).
 * `targetRoot` is the consumer's cwd; `file.target` resolves against it.
 */
export const runAdd = (args: {
  readonly manifest: RegistryManifest;
  readonly itemName: string;
  readonly sourceRoot: string;
  readonly targetRoot: string;
}): Effect.Effect<ReadonlyArray<CopyOutcome>, AddError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    let resolved: ReturnType<typeof resolveItems>;
    try {
      resolved = resolveItems(args.manifest, args.itemName);
    } catch (cause) {
      return yield* Effect.fail(
        new AddError({
          code: "UNKNOWN_ITEM",
          message: describe(cause),
        }),
      );
    }

    // De-duplicate file copies across items (e.g. `admin-shell` lists files
    // its registryDeps already vended). `resolveItems` is topological so
    // deps come first — first occurrence of a `target` wins.
    const seenTargets = new Set<string>();
    const outcomes: Array<CopyOutcome> = [];

    for (const item of resolved) {
      for (const file of item.files) {
        if (seenTargets.has(file.target)) continue;
        seenTargets.add(file.target);

        const sourcePath = path.join(args.sourceRoot, file.path);
        const targetPath = path.join(args.targetRoot, file.target);

        const sourceExists = yield* fs.exists(sourcePath).pipe(Effect.orElseSucceed(() => false));
        if (!sourceExists) {
          return yield* Effect.fail(
            new AddError({
              code: "MISSING_SOURCE",
              message: `Registry source missing: ${sourcePath}`,
            }),
          );
        }

        const sourceBytes = yield* fs
          .readFile(sourcePath)
          .pipe(Effect.mapError(wrapFsError("MISSING_SOURCE", `Failed to read ${sourcePath}`)));

        const targetExists = yield* fs.exists(targetPath).pipe(Effect.orElseSucceed(() => false));
        if (targetExists) {
          const existing = yield* fs
            .readFile(targetPath)
            .pipe(
              Effect.mapError(
                wrapFsError("WRITE_FAILED", `Failed to read existing target ${targetPath}`),
              ),
            );
          if (bytesEqual(existing, sourceBytes)) {
            console.log(`unchanged  ${file.target}`);
            outcomes.push({
              source: sourcePath,
              target: targetPath,
              status: "unchanged",
            });
            continue;
          }
          // Drift: never overwrite in M0.
          console.log(`skip (drift)  ${file.target}`);
          outcomes.push({
            source: sourcePath,
            target: targetPath,
            status: "skip-drift",
          });
          continue;
        }

        yield* fs
          .makeDirectory(path.dirname(targetPath), { recursive: true })
          .pipe(Effect.mapError(wrapFsError("WRITE_FAILED", `Failed to mkdir ${targetPath}`)));
        yield* fs
          .writeFile(targetPath, sourceBytes)
          .pipe(Effect.mapError(wrapFsError("WRITE_FAILED", `Failed to write ${targetPath}`)));
        console.log(`wrote  ${file.target}`);
        outcomes.push({
          source: sourcePath,
          target: targetPath,
          status: "wrote",
        });
      }
    }
    return outcomes;
  });

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

/**
 * The `voila add` Effect. Loads the bundled manifest and resolves the
 * registry source root from `@voila/content-registry`'s URL.
 */
export const addProgram = (args: {
  readonly itemName: string;
  readonly cwd: string;
}): Effect.Effect<void, AddError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const manifest = loadManifest();
    const sourceRoot = defaultRegistrySourceRoot();
    yield* runAdd({
      manifest,
      itemName: args.itemName,
      sourceRoot,
      targetRoot: args.cwd,
    });
  });

/**
 * `voila add <item> [--cwd <path>]` command descriptor.
 */
export const addCommand: Command.Command<
  "add",
  FileSystem.FileSystem | Path.Path,
  AddError,
  { readonly item: string; readonly cwd: string }
> = Command.make(
  "add",
  {
    item: Args.text({ name: "item" }),
    cwd: Options.directory("cwd", { exists: "either" }).pipe(Options.withDefault(process.cwd())),
  },
  ({ item, cwd }) => addProgram({ itemName: item, cwd }),
).pipe(Command.withDescription("Copy a registry item into the current project"));

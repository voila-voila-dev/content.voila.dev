// Loads a consumer's `content.config.ts` and hands back the `NormalizedConfig`
// the migration commands derive tables from. The config is a TS module
// default-exporting the result of `defineConfig`; Bun imports `.ts` directly.

import { Path } from "@effect/platform/Path";
import { Data, Effect } from "effect";
import type { NormalizedConfig } from "../config/config";

export class ConfigLoadError extends Data.TaggedError("ConfigLoadError")<{
  readonly path: string;
  readonly message: string;
}> {}

/**
 * Resolve `configPath` against the current working directory, import it, and
 * return its default export as a `NormalizedConfig`. `collections`/`singletons`
 * are defaulted to `{}` so a config that defines only one still derives.
 */
export const loadConfig = (
  configPath: string,
): Effect.Effect<NormalizedConfig, ConfigLoadError, Path> =>
  Effect.gen(function* () {
    const path = yield* Path;
    const abs = path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath);

    const mod = yield* Effect.tryPromise({
      try: () => import(abs),
      catch: (cause) =>
        new ConfigLoadError({
          path: abs,
          message: cause instanceof Error ? cause.message : String(cause),
        }),
    });

    const config = mod.default as NormalizedConfig | undefined;
    if (config === undefined || typeof config !== "object" || !("collections" in config)) {
      return yield* Effect.fail(
        new ConfigLoadError({
          path: abs,
          message: "config has no default export with a `collections` map",
        }),
      );
    }

    return {
      ...config,
      collections: config.collections ?? {},
      singletons: config.singletons ?? {},
    };
  });

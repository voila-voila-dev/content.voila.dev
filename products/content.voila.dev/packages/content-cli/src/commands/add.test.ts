import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { BunContext } from "@effect/platform-bun";
import type { RegistryManifest } from "@voila/content-registry";
import { Cause, Effect, Exit } from "effect";
import { AddError, runAdd } from "./add.ts";

interface FakeLayout {
  readonly sourceRoot: string;
  readonly targetRoot: string;
  readonly cleanup: () => void;
}

const writeFile = (full: string, content: string): void => {
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, "utf8");
};

const makeLayout = (): FakeLayout => {
  const root = mkdtempSync(join(tmpdir(), "voila-add-"));
  const sourceRoot = join(root, "registry-pkg");
  const targetRoot = join(root, "consumer-app");
  mkdirSync(sourceRoot, { recursive: true });
  mkdirSync(targetRoot, { recursive: true });
  return {
    sourceRoot,
    targetRoot,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
};

const fakeManifest: RegistryManifest = {
  name: "fake",
  items: [
    {
      name: "leaf",
      type: "registry:file",
      description: "leaf item",
      files: [
        {
          path: "src/items/leaf/app/leaf.ts",
          target: "app/leaf.ts",
          type: "registry:file",
        },
      ],
      deps: [],
      registryDeps: [],
    },
    {
      name: "shell",
      type: "registry:component",
      description: "shell that depends on leaf",
      files: [
        {
          path: "src/items/shell/app/shell.tsx",
          target: "app/shell.tsx",
          type: "registry:file",
        },
      ],
      deps: [],
      registryDeps: ["leaf"],
    },
  ],
};

let layout: FakeLayout;

beforeEach(() => {
  layout = makeLayout();
  writeFile(join(layout.sourceRoot, "src/items/leaf/app/leaf.ts"), "export const leaf = 1\n");
  writeFile(
    join(layout.sourceRoot, "src/items/shell/app/shell.tsx"),
    "export const Shell = () => null\n",
  );
});

afterEach(() => {
  layout.cleanup();
});

describe("runAdd", () => {
  test("copies a single item's files", async () => {
    const outcomes = await Effect.runPromise(
      runAdd({
        manifest: fakeManifest,
        itemName: "leaf",
        sourceRoot: layout.sourceRoot,
        targetRoot: layout.targetRoot,
      }).pipe(Effect.provide(BunContext.layer)),
    );
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.status).toBe("wrote");
    const written = readFileSync(join(layout.targetRoot, "app/leaf.ts"), "utf8");
    expect(written).toBe("export const leaf = 1\n");
  });

  test("resolves registryDeps transitively (leaf before shell)", async () => {
    const outcomes = await Effect.runPromise(
      runAdd({
        manifest: fakeManifest,
        itemName: "shell",
        sourceRoot: layout.sourceRoot,
        targetRoot: layout.targetRoot,
      }).pipe(Effect.provide(BunContext.layer)),
    );
    expect(outcomes).toHaveLength(2);
    expect(outcomes[0]?.target.endsWith("app/leaf.ts")).toBe(true);
    expect(outcomes[1]?.target.endsWith("app/shell.tsx")).toBe(true);
    expect(readFileSync(join(layout.targetRoot, "app/shell.tsx"), "utf8")).toBe(
      "export const Shell = () => null\n",
    );
  });

  test("returns 'unchanged' for byte-identical targets", async () => {
    // First add: writes the file.
    await Effect.runPromise(
      runAdd({
        manifest: fakeManifest,
        itemName: "leaf",
        sourceRoot: layout.sourceRoot,
        targetRoot: layout.targetRoot,
      }).pipe(Effect.provide(BunContext.layer)),
    );
    // Second add: identical.
    const outcomes = await Effect.runPromise(
      runAdd({
        manifest: fakeManifest,
        itemName: "leaf",
        sourceRoot: layout.sourceRoot,
        targetRoot: layout.targetRoot,
      }).pipe(Effect.provide(BunContext.layer)),
    );
    expect(outcomes[0]?.status).toBe("unchanged");
  });

  test("returns 'skip-drift' when target differs and does NOT overwrite", async () => {
    writeFile(join(layout.targetRoot, "app/leaf.ts"), "// drifted content\n");
    const outcomes = await Effect.runPromise(
      runAdd({
        manifest: fakeManifest,
        itemName: "leaf",
        sourceRoot: layout.sourceRoot,
        targetRoot: layout.targetRoot,
      }).pipe(Effect.provide(BunContext.layer)),
    );
    expect(outcomes[0]?.status).toBe("skip-drift");
    expect(readFileSync(join(layout.targetRoot, "app/leaf.ts"), "utf8")).toBe(
      "// drifted content\n",
    );
  });

  test("fails with UNKNOWN_ITEM for missing item", async () => {
    const exit = await Effect.runPromiseExit(
      runAdd({
        manifest: fakeManifest,
        itemName: "no-such-item",
        sourceRoot: layout.sourceRoot,
        targetRoot: layout.targetRoot,
      }).pipe(Effect.provide(BunContext.layer)),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(failure._tag).toBe("Some");
      if (failure._tag === "Some") {
        expect(failure.value).toBeInstanceOf(AddError);
        expect((failure.value as AddError).code).toBe("UNKNOWN_ITEM");
      }
    }
  });

  test("fails with MISSING_SOURCE when registry file is absent", async () => {
    const brokenManifest: RegistryManifest = {
      name: "fake",
      items: [
        {
          name: "broken",
          type: "registry:file",
          description: "no source on disk",
          files: [
            {
              path: "src/items/broken/missing.ts",
              target: "app/missing.ts",
            },
          ],
          deps: [],
          registryDeps: [],
        },
      ],
    };
    const exit = await Effect.runPromiseExit(
      runAdd({
        manifest: brokenManifest,
        itemName: "broken",
        sourceRoot: layout.sourceRoot,
        targetRoot: layout.targetRoot,
      }).pipe(Effect.provide(BunContext.layer)),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      if (failure._tag === "Some") {
        expect((failure.value as AddError).code).toBe("MISSING_SOURCE");
      }
    }
  });
});

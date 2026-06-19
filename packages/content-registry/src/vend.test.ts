import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vendFiles } from "./vend";

describe("vendFiles", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "voila-vend-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("writes a file's source to its target, creating directories", async () => {
    const result = await vendFiles([{ path: "app/lib/content-client.ts" }], { cwd: dir });
    expect(result.written).toEqual(["app/lib/content-client.ts"]);
    expect(result.skipped).toEqual([]);
    const written = readFileSync(join(dir, "app/lib/content-client.ts"), "utf8");
    expect(written).toContain("makeClient");
  });

  test("honors a target override for the destination", async () => {
    await vendFiles([{ path: "app/lib/content-client.ts", target: "src/content.ts" }], {
      cwd: dir,
    });
    expect(existsSync(join(dir, "src/content.ts"))).toBe(true);
    expect(existsSync(join(dir, "app/lib/content-client.ts"))).toBe(false);
  });

  test("skips an existing target by default", async () => {
    await vendFiles([{ path: "app/lib/content-client.ts" }], { cwd: dir });
    const result = await vendFiles([{ path: "app/lib/content-client.ts" }], { cwd: dir });
    expect(result.written).toEqual([]);
    expect(result.skipped).toEqual(["app/lib/content-client.ts"]);
  });

  test("overwrites an existing target when asked", async () => {
    const file = { path: "app/lib/content-client.ts" };
    await vendFiles([file], { cwd: dir });
    // clobber the local copy, then re-vend with overwrite
    const dest = join(dir, "app/lib/content-client.ts");
    const result = await vendFiles([file], { cwd: dir, overwrite: true });
    expect(result.written).toEqual(["app/lib/content-client.ts"]);
    expect(readFileSync(dest, "utf8")).toContain("makeClient");
  });

  test("reads from a custom source when `read` is given", async () => {
    const result = await vendFiles([{ path: "anywhere/made-up.ts" }], {
      cwd: dir,
      read: async (file) => `// source for ${file.path}\n`,
    });
    expect(result.written).toEqual(["anywhere/made-up.ts"]);
    expect(readFileSync(join(dir, "anywhere/made-up.ts"), "utf8")).toBe(
      "// source for anywhere/made-up.ts\n",
    );
  });

  test("applies `transform` to the source before writing", async () => {
    await vendFiles([{ path: "app/lib/content-client.ts" }], {
      cwd: dir,
      transform: (contents) => contents.replaceAll("makeClient", "makeTestClient"),
    });
    const written = readFileSync(join(dir, "app/lib/content-client.ts"), "utf8");
    expect(written).toContain("makeTestClient");
    expect(written).not.toContain("makeClient(config");
  });

  test("writes multiple files in one call", async () => {
    const result = await vendFiles(
      [{ path: "app/lib/content-client.ts" }, { path: "app/components/admin-layout.tsx" }],
      { cwd: dir },
    );
    expect(result.written).toHaveLength(2);
    expect(existsSync(join(dir, "app/components/admin-layout.tsx"))).toBe(true);
  });
});

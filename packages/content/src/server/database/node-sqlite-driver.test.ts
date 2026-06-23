// The `node:sqlite` driver honours the same `SqlDriver` contract the bun one
// does. Bun doesn't implement `node:sqlite`, so the suite pins three things
// in-process — the module stays loadable on any runtime, the factory fails
// with a descriptive error where Node's SQLite is missing, and the URL
// normalization re-export — and then verifies the actual round-trip behaviour
// (reads, writes, boolean coercion) by bundling the driver and running it
// under a real `node` subprocess.

import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeNodeSqliteDriver, resolveSqliteUrl } from "./node-sqlite-driver";

const hasNodeSqlite = process.getBuiltinModule?.("node:sqlite") !== undefined;

// `node` resolution may go through a version-manager shim whose answer depends
// on cwd — spawn from this package dir so the repo-pinned version applies, and
// skip when the resolved node predates `node:sqlite`.
const nodeBin = Bun.which("node");
const nodeHasSqlite =
  nodeBin !== null &&
  Bun.spawnSync([nodeBin, "-e", "process.getBuiltinModule?.('node:sqlite') ?? process.exit(1)"], {
    cwd: import.meta.dir,
  }).exitCode === 0;

describe("makeNodeSqliteDriver", () => {
  it.skipIf(hasNodeSqlite)("throws a descriptive error where node:sqlite is missing", () => {
    expect(() => makeNodeSqliteDriver({ url: ":memory:" })).toThrow("node:sqlite is not available");
  });

  it.skipIf(!nodeHasSqlite)("round-trips rows under a real node subprocess", async () => {
    if (!nodeBin) throw new Error("unreachable: skipped without a node binary");
    const bundle = await Bun.build({
      entrypoints: [join(import.meta.dir, "node-sqlite-driver.ts")],
      target: "node",
    });
    const [output] = bundle.outputs;
    if (!output) throw new Error("Bun.build produced no output");
    const driverJs = await output.text();

    const dir = mkdtempSync(join(tmpdir(), "voila-node-sqlite-"));
    try {
      writeFileSync(join(dir, "driver.mjs"), driverJs);
      writeFileSync(
        join(dir, "main.mjs"),
        `import { makeNodeSqliteDriver } from "./driver.mjs";
const driver = makeNodeSqliteDriver({ url: "file::memory:" });
await driver.run('CREATE TABLE "t" ("id" TEXT PRIMARY KEY, "flag" INTEGER)');
await driver.run('INSERT INTO "t" VALUES (?, ?)', ["a", true]);
await driver.run('INSERT INTO "t" VALUES (?, ?)', ["b", false]);
const rows = await driver.all('SELECT "id" FROM "t" WHERE "flag" = ?', [true]);
driver.close();
console.log(JSON.stringify(rows));
`,
      );
      const proc = Bun.spawnSync([nodeBin, join(dir, "main.mjs")], { cwd: import.meta.dir });
      expect(proc.exitCode).toBe(0);
      expect(JSON.parse(proc.stdout.toString().trim())).toEqual([{ id: "a" }]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("resolveSqliteUrl", () => {
  it("maps in-memory URLs to :memory:", () => {
    expect(resolveSqliteUrl(":memory:")).toBe(":memory:");
    expect(resolveSqliteUrl("file::memory:")).toBe(":memory:");
  });

  it("strips the file: scheme", () => {
    expect(resolveSqliteUrl("file:./local.db")).toBe("./local.db");
    expect(resolveSqliteUrl("file:/abs/local.db")).toBe("/abs/local.db");
  });

  it("passes bare paths through", () => {
    expect(resolveSqliteUrl("./local.db")).toBe("./local.db");
  });
});

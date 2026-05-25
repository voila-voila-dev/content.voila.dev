import { describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateInstallAuth, nextMigrationPrefix } from "./migrate-install-auth.ts";

const FAKE_SQL = "-- fake bundled auth migration\nCREATE TABLE auth_test (id INTEGER);\n";

describe("migrateInstallAuth", () => {
  test("copies the bundled migration into the next free numeric slot", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "voila-install-auth-"));
    const out = join(cwd, "migrations");
    const sourcePath = join(cwd, "fixture.sql");
    writeFileSync(sourcePath, FAKE_SQL);
    // Pre-seed a 0000 migration so the picker has to advance to 0001.
    require("node:fs").mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "0000_init.sql"), "-- existing\n");

    const result = await migrateInstallAuth({ cwd, out: "./migrations", sourcePath });
    expect(result.installed).toBe(true);
    expect(result.filename).toBe("0001_auth_init.sql");
    expect(readFileSync(result.destination, "utf8")).toBe(FAKE_SQL);
  });

  test("is idempotent — second run reports `installed: false` and reuses the same file", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "voila-install-auth-"));
    const sourcePath = join(cwd, "fixture.sql");
    writeFileSync(sourcePath, FAKE_SQL);
    await migrateInstallAuth({ cwd, sourcePath });
    const second = await migrateInstallAuth({ cwd, sourcePath });
    expect(second.installed).toBe(false);
    expect(second.filename).toBe("0000_auth_init.sql");
  });

  test("throws a clear error when the source path is missing", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "voila-install-auth-"));
    await expect(migrateInstallAuth({ cwd, sourcePath: join(cwd, "nope.sql") })).rejects.toThrow(
      /bundled migration not found/,
    );
  });
});

describe("nextMigrationPrefix", () => {
  test("returns 0000 when the directory does not exist", () => {
    expect(nextMigrationPrefix("/nonexistent/path/here")).toBe("0000");
  });

  test("returns max(NNNN_*.sql) + 1 zero-padded", () => {
    const dir = mkdtempSync(join(tmpdir(), "voila-prefix-"));
    writeFileSync(join(dir, "0003_x.sql"), "");
    writeFileSync(join(dir, "0042_x.sql"), "");
    writeFileSync(join(dir, "not_a_match.sql"), "");
    expect(nextMigrationPrefix(dir)).toBe("0043");
    void readdirSync; // keep the import alive for the broader test file scope
  });
});

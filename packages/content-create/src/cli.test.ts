import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { toPackageName } from "./index";

const binPath = join(import.meta.dir, "bin.ts");

const create = (cwd: string, ...args: Array<string>) => {
  const proc = Bun.spawnSync({ cmd: ["bun", binPath, ...args], cwd });
  return {
    exitCode: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
};

describe("toPackageName", () => {
  it("lowercases and replaces invalid characters", () => {
    expect(toPackageName("My Blog!")).toBe("my-blog");
    expect(toPackageName("  Acme/CMS  ")).toBe("acme-cms");
  });

  it("falls back when nothing valid remains", () => {
    expect(toPackageName("***")).toBe("voila-app");
  });
});

describe("create-content-voila (subprocess)", () => {
  let work: string;

  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), "voila-create-cli-"));
  });
  afterEach(() => {
    rmSync(work, { recursive: true, force: true });
  });

  it("scaffolds a project into the target dir (no install)", () => {
    const result = create(work, "my-app", "--no-install");
    expect(result.exitCode).toBe(0);
    expect(existsSync(join(work, "my-app/package.json"))).toBe(true);
    expect(existsSync(join(work, "my-app/app/routes/_app.tsx"))).toBe(true);
    expect(existsSync(join(work, "my-app/.gitignore"))).toBe(true);
    const pkg = JSON.parse(readFileSync(join(work, "my-app/package.json"), "utf8"));
    expect(pkg.name).toBe("my-app");
    expect(result.stdout).toContain("Next steps:");
  });

  it("honors --name over the directory name", () => {
    create(work, "some-dir", "--name", "Custom Name", "--no-install");
    const pkg = JSON.parse(readFileSync(join(work, "some-dir/package.json"), "utf8"));
    expect(pkg.name).toBe("custom-name");
  });

  it("requires a target directory", () => {
    const result = create(work);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Usage: create-content-voila");
  });

  it("refuses a non-empty directory unless --force", () => {
    writeFileSync(join(work, "occupied.txt"), "x");
    const blocked = create(work, ".", "--no-install");
    expect(blocked.exitCode).not.toBe(0);
    expect(blocked.stderr).toContain("is not empty");

    const forced = create(work, ".", "--no-install", "--force", "--name", "forced");
    expect(forced.exitCode).toBe(0);
    expect(existsSync(join(work, "package.json"))).toBe(true);
  });
});

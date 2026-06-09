import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { destName, scaffold, TEMPLATE_DIR } from "./scaffold";

describe("destName", () => {
  test("turns a dot- prefixed basename into a dotfile", () => {
    expect(destName("dot-gitignore")).toBe(".gitignore");
    expect(destName("app/dot-npmrc")).toBe("app/.npmrc");
  });

  test("leaves normal paths untouched, including __root", () => {
    expect(destName("package.json")).toBe("package.json");
    expect(destName("app/routes/index.tsx")).toBe("app/routes/index.tsx");
    expect(destName("app/routes/__root.tsx")).toBe("app/routes/__root.tsx");
  });
});

describe("scaffold", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "voila-create-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("copies the bundled template into the target", async () => {
    const result = await scaffold({ targetDir: dir, projectName: "acme" });
    expect(result.files).toContain("package.json");
    expect(result.files).toContain("app/routes/__root.tsx");
    expect(result.files).toContain("content.config.ts");
  });

  test("renames the gitignore stub", async () => {
    const result = await scaffold({ targetDir: dir, projectName: "acme" });
    expect(result.files).toContain(".gitignore");
    expect(result.files).not.toContain("_gitignore");
    expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain("node_modules");
  });

  test("substitutes {{projectName}} in package.json and config", async () => {
    await scaffold({ targetDir: dir, projectName: "my-blog" });
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    expect(pkg.name).toBe("my-blog");
    expect(readFileSync(join(dir, "content.config.ts"), "utf8")).toContain('name: "my-blog"');
  });

  test("scaffolds from a custom template directory", async () => {
    // Point at the real template to prove the option is honored.
    const result = await scaffold({ targetDir: dir, projectName: "x", templateDir: TEMPLATE_DIR });
    expect(result.files.length).toBeGreaterThan(0);
  });

  test("leaves no placeholder tokens behind", async () => {
    const result = await scaffold({ targetDir: dir, projectName: "acme" });
    for (const file of result.files) {
      expect(readFileSync(join(dir, file), "utf8"), file).not.toContain("{{projectName}}");
    }
  });
});

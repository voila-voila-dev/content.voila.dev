import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileTarget, registry, resolve } from "@voila/content-registry";
import { DEFAULT_ITEMS, destName, scaffold, TEMPLATE_DIR } from "./scaffold";

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
      const contents = readFileSync(join(dir, file), "utf8");
      expect(contents, file).not.toContain("{{projectName}}");
      expect(contents, file).not.toContain("{{authSecret}}");
    }
  });

  test("writes a .env with a generated auth secret", async () => {
    const result = await scaffold({ targetDir: dir, projectName: "acme" });
    expect(result.files).toContain(".env");
    const env = readFileSync(join(dir, ".env"), "utf8");
    const secret = env.match(/^VOILA_AUTH_SECRET=(.+)$/m)?.[1]?.trim();
    expect(secret, "VOILA_AUTH_SECRET should be set").toBeTruthy();
    expect((secret ?? "").length, "the secret should be high-entropy").toBeGreaterThanOrEqual(32);
  });

  test("each scaffold gets its own secret", async () => {
    const dir2 = mkdtempSync(join(tmpdir(), "voila-create-"));
    try {
      await scaffold({ targetDir: dir, projectName: "a" });
      await scaffold({ targetDir: dir2, projectName: "b" });
      const read = (d: string) =>
        readFileSync(join(d, ".env"), "utf8").match(/^VOILA_AUTH_SECRET=(.+)$/m)?.[1];
      expect(read(dir)).not.toBe(read(dir2));
    } finally {
      rmSync(dir2, { recursive: true, force: true });
    }
  });

  // The exact regression the 2026-06-13 audit caught: the scaffolded REST mount
  // must wire auth, CSRF, and access control — not ship a world-open API.
  test("scaffolds a secure-by-default REST mount", async () => {
    await scaffold({ targetDir: dir, projectName: "acme" });
    const server = readFileSync(join(dir, "app/lib/server.ts"), "utf8");
    expect(server).toContain("auth:");
    expect(server).toContain("csrf:");
    expect(server).toContain("access:");
    expect(server).toContain("firstUserAccess");
    // The login page + session guard ship too.
    expect(existsSync(join(dir, "app/routes/admin_.login.tsx"))).toBe(true);
    expect(existsSync(join(dir, "app/lib/auth.ts"))).toBe(true);
    // The migrate script provisions the auth tables.
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.["migrate:generate"]).toContain("--auth");
  });

  test("vends the registry's default item set (single-sourced admin files)", async () => {
    const result = await scaffold({ targetDir: dir, projectName: "acme" });
    const plan = resolve(registry, DEFAULT_ITEMS);
    for (const file of plan.files) {
      const target = fileTarget(file);
      expect(result.files, target).toContain(target);
      expect(existsSync(join(dir, target)), target).toBe(true);
    }
    // The shell really came from the registry, not a stale template copy.
    const layout = readFileSync(join(dir, "app/components/admin-layout.tsx"), "utf8");
    expect(layout).toContain("renderLink");
  });
});

// The admin source has one home: the registry. The template must not shadow it
// (a duplicate would be free to diverge again — see the 2026-06-12 audit #19),
// and its package.json must already carry every npm dependency the default
// items would install, at the registry's exact range.
describe("template ↔ registry single source", () => {
  const plan = resolve(registry, DEFAULT_ITEMS);
  const templatePkg = JSON.parse(readFileSync(join(TEMPLATE_DIR, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const templateDeps = { ...templatePkg.dependencies, ...templatePkg.devDependencies };

  test("the template does not duplicate registry-owned files", () => {
    for (const file of plan.files) {
      expect(existsSync(join(TEMPLATE_DIR, file.path)), file.path).toBe(false);
    }
  });

  for (const [name, range] of Object.entries(plan.dependencies)) {
    test(`template pins ${name} at the registry's range (${range})`, () => {
      expect(
        templateDeps[name],
        `the registry's default items need ${name}@${range} but the template pins ${templateDeps[name] ?? "nothing"} — keep them in lockstep`,
      ).toBe(range);
    });
  }
});

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { itemSourcePath } from "./files";
import { registry } from "./registry";
import { getItem, listItems, resolve } from "./resolve";
import { fileTarget } from "./types";

// The catalog must be internally consistent: unique names, every registry
// dependency resolvable, no cycles, and every declared file present on disk —
// otherwise `voila add` would fail at vend time on a real install.
describe("registry catalog integrity", () => {
  test("item names are unique and kebab-case", () => {
    const names = registry.items.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  test("every registryDependency resolves to a known item", () => {
    for (const item of registry.items) {
      for (const dep of item.registryDependencies ?? []) {
        expect(getItem(registry, dep), `${item.name} → ${dep}`).toBeDefined();
      }
    }
  });

  test("resolving every item together has no cycles or conflicts", () => {
    const all = registry.items.map((i) => i.name);
    expect(() => resolve(registry, all)).not.toThrow();
  });

  test("every declared file exists on disk", () => {
    for (const item of registry.items) {
      for (const file of item.files) {
        expect(existsSync(itemSourcePath(file)), `${item.name}: ${file.path}`).toBe(true);
      }
    }
  });

  test("items declare at least one file each", () => {
    for (const item of registry.items) {
      expect(item.files.length, item.name).toBeGreaterThan(0);
    }
  });

  test("the seeded admin chain resolves dependency-first", () => {
    const plan = resolve(registry, ["admin-routes"]);
    expect(plan.items.map((i) => i.name)).toEqual([
      "content-client",
      "admin-shell",
      "admin-auth",
      "admin-routes",
    ]);
    expect(plan.dependencies).toMatchObject({ "@voila/content": expect.any(String) });
    const targets = plan.files.map((f) => fileTarget(f));
    expect(targets).toContain("app/components/admin-layout.tsx");
    // The auth slice (login page + session guard helper) rides along by default.
    expect(targets).toContain("app/routes/admin_.login.tsx");
    expect(targets).toContain("app/lib/auth.ts");
    expect(plan.dependencies).toMatchObject({ "@tanstack/react-start": expect.any(String) });
  });

  test("listItems can scope the catalog by type", () => {
    expect(listItems(registry, "shell").map((i) => i.name)).toEqual(["admin-shell"]);
  });

  test("rich-text-editor installs the widgets seam first and overrides its file", () => {
    const plan = resolve(registry, ["rich-text-editor"]);
    expect(plan.items.map((i) => i.name)).toEqual(["widgets", "rich-text-editor"]);
    // The seam file is owned by `widgets` but overwritten by the rich-text
    // flavored source (same target, dependent wins).
    const widgetsFile = plan.files.find((f) => fileTarget(f) === "app/lib/widgets.ts");
    expect(widgetsFile?.path).toBe("app/lib/widgets.rich-text.ts");
    expect(plan.dependencies).toMatchObject({ "@voila/rich-text-editor": expect.any(String) });
  });
});

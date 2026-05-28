import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type RegistryManifest, registryManifestUrl, resolveItems } from "./index.ts";

const manifest: RegistryManifest = JSON.parse(
  readFileSync(fileURLToPath(registryManifestUrl), "utf8"),
) as RegistryManifest;

describe("registry.json manifest", () => {
  test("parses with the expected top-level shape", () => {
    expect(manifest.name).toBe("voila");
    expect(Array.isArray(manifest.items)).toBe(true);
  });

  test("contains the M0 items", () => {
    const names = manifest.items.map((i) => i.name);
    expect(names).toContain("admin-shell");
    expect(names).toContain("route/admin-splat");
    expect(names).toContain("server/mount");
  });

  test("admin-shell registryDeps include the two M0 file items", () => {
    const shell = manifest.items.find((i) => i.name === "admin-shell");
    expect(shell).toBeDefined();
    expect(shell?.registryDeps).toContain("route/admin-splat");
    expect(shell?.registryDeps).toContain("server/mount");
    expect(shell?.deps).toContain("@voila/content");
    expect(shell?.deps).toContain("@tanstack/react-router");
  });
});

describe("resolveItems", () => {
  test("returns a topological order ending with admin-shell", () => {
    const resolved = resolveItems(manifest, "admin-shell");
    const order = resolved.map((i) => i.name);

    expect(order[order.length - 1]).toBe("admin-shell");
    expect(order).toContain("route/admin-splat");
    expect(order).toContain("server/mount");

    // each dep must appear strictly before admin-shell
    const shellIdx = order.indexOf("admin-shell");
    expect(order.indexOf("route/admin-splat")).toBeLessThan(shellIdx);
    expect(order.indexOf("server/mount")).toBeLessThan(shellIdx);

    // deduplicated
    expect(new Set(order).size).toBe(order.length);
  });

  test("throws on unknown item", () => {
    expect(() => resolveItems(manifest, "no-such-item")).toThrow();
  });
});

describe("vended source files", () => {
  const readVended = (rel: string): string =>
    readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), "utf8");

  test("admin/$.tsx is plain React + TanStack", () => {
    const src = readVended("src/items/admin-shell/app/routes/admin/$.tsx");
    expect(src).toContain("createFileRoute");
    expect(src).toContain("~/content.config");
    expect(src).not.toContain('from "effect');
    expect(src).not.toContain("from '@effect/");
  });

  test("server/voila.ts mounts the engine handler", () => {
    const src = readVended("src/items/admin-shell/app/server/voila.ts");
    expect(src).toContain("makeHandler");
    expect(src).toContain("@voila/content/server");
    expect(src).toContain("~/content.config");
  });
});

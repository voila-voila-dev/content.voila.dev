import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { listProgram, loadManifest } from "./list.ts";

describe("loadManifest", () => {
  test("reads the bundled registry.json", () => {
    const manifest = loadManifest();
    expect(manifest.name).toBe("voila");
    const names = manifest.items.map((i) => i.name);
    expect(names).toContain("admin-shell");
    expect(names).toContain("route/admin-splat");
    expect(names).toContain("server/mount");
  });
});

describe("listProgram", () => {
  test("prints one line per item to stdout", async () => {
    const lines: Array<string> = [];
    const orig = console.log;
    console.log = (msg: unknown): void => {
      lines.push(String(msg));
    };
    try {
      await Effect.runPromise(listProgram);
    } finally {
      console.log = orig;
    }
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((l) => l.startsWith("admin-shell"))).toBe(true);
    expect(lines.some((l) => l.startsWith("route/admin-splat"))).toBe(true);
    expect(lines.some((l) => l.startsWith("server/mount"))).toBe(true);
  });
});

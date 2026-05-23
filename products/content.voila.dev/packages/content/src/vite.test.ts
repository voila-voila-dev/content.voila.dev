import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineContent } from "./define.ts";
import { voila } from "./vite.ts";

describe("voila() vite plugin", () => {
  test("returns a vite Plugin object", () => {
    const plugin = voila();
    expect(plugin.name).toBe("@voila/content");
    expect(plugin.enforce).toBe("pre");
  });

  test("auto-discovers ./content.config.ts by default", () => {
    const plugin = voila();
    const api = plugin.api as { configSource: string };
    expect(api.configSource).toBe("./content.config.ts");
  });

  test("accepts a custom config path", () => {
    const plugin = voila({ config: "./other.config.ts" });
    const api = plugin.api as { configSource: string };
    expect(api.configSource).toBe("./other.config.ts");
  });

  test("accepts an inline Content object", () => {
    const content = defineContent({ branding: { name: "Inline" } });
    const plugin = voila({ config: content });
    const api = plugin.api as { configSource: typeof content };
    expect(api.configSource).toBe(content);
  });
});

describe("voila() route generation", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "voila-vite-test-"));
    writeFileSync(join(root, "content.config.ts"), "export default {};\n");
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function runConfigResolved(plugin: ReturnType<typeof voila>) {
    const hook = plugin.configResolved;
    const fn = typeof hook === "function" ? hook : hook?.handler;
    // biome-ignore lint/suspicious/noExplicitAny: minimal fake of ResolvedConfig for the plugin's needs.
    fn?.call(plugin as any, { root } as any);
  }

  test("writes admin splat, setup, and health route files when content.config.ts exists", () => {
    runConfigResolved(voila());
    expect(existsSync(join(root, "src/routes/admin/$.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/routes/admin/setup.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/routes/admin/api/health.ts"))).toBe(true);
  });

  test("generated files import content config + carry the DO NOT EDIT header", () => {
    runConfigResolved(voila());
    const splat = readFileSync(join(root, "src/routes/admin/$.tsx"), "utf8");
    expect(splat).toContain("DO NOT EDIT");
    expect(splat).toContain('from "@voila/content/internal"');
    expect(splat).toContain('import content from "../../../content.config"');
    expect(splat).toContain('createFileRoute("/admin/$")');
  });

  test("generated health route is a TanStack Start file route with a GET server handler", () => {
    runConfigResolved(voila());
    const health = readFileSync(join(root, "src/routes/admin/api/health.ts"), "utf8");
    expect(health).toContain('createFileRoute("/admin/api/health")');
    expect(health).toContain('"@tanstack/react-router"');
    expect(health).toContain("server:");
    expect(health).toContain("GET:");
    expect(health).toContain("ok: true");
  });

  test("skips generation when content.config.ts is absent", () => {
    rmSync(join(root, "content.config.ts"));
    runConfigResolved(voila());
    expect(existsSync(join(root, "src/routes/admin"))).toBe(false);
  });
});

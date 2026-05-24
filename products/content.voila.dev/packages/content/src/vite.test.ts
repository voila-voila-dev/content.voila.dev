import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  test("writes layout, index, setup, view, and health route files when content.config.ts exists", () => {
    runConfigResolved(voila());
    expect(existsSync(join(root, "src/routes/admin.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/routes/admin/index.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/routes/admin/setup.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/routes/admin/collections.$collection.index.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/routes/admin/collections.$collection.$id.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/routes/admin/singletons.$singleton.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/routes/admin/api/health.ts"))).toBe(true);
  });

  test("removes a stale admin/$.tsx splat from older generations", () => {
    // Pre-seed the legacy splat as if a previous version of the plugin emitted it.
    mkdirSync(join(root, "src/routes/admin"), { recursive: true });
    writeFileSync(join(root, "src/routes/admin/$.tsx"), "// legacy splat\n");
    runConfigResolved(voila());
    expect(existsSync(join(root, "src/routes/admin/$.tsx"))).toBe(false);
  });

  test("generated files import content config + carry the DO NOT EDIT header", () => {
    runConfigResolved(voila());

    const layout = readFileSync(join(root, "src/routes/admin.tsx"), "utf8");
    expect(layout).toContain("DO NOT EDIT");
    expect(layout).toContain('from "@voila/content/internal"');
    expect(layout).toContain('import content from "../../content.config"');
    expect(layout).toContain('createFileRoute("/admin")');

    const list = readFileSync(
      join(root, "src/routes/admin/collections.$collection.index.tsx"),
      "utf8",
    );
    expect(list).toContain('createFileRoute("/admin/collections/$collection/")');
    expect(list).toContain("CollectionListView");

    const detail = readFileSync(
      join(root, "src/routes/admin/collections.$collection.$id.tsx"),
      "utf8",
    );
    expect(detail).toContain('createFileRoute("/admin/collections/$collection/$id")');
    expect(detail).toContain("CollectionDetailView");

    const singleton = readFileSync(
      join(root, "src/routes/admin/singletons.$singleton.tsx"),
      "utf8",
    );
    expect(singleton).toContain('createFileRoute("/admin/singletons/$singleton")');
    expect(singleton).toContain("SingletonView");
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

  test("falls back to a content.config.tsx sibling for the default path", () => {
    rmSync(join(root, "content.config.ts"));
    writeFileSync(join(root, "content.config.tsx"), "export default {};\n");
    runConfigResolved(voila());
    expect(existsSync(join(root, "src/routes/admin.tsx"))).toBe(true);
    // Generated imports stay extensionless regardless of the config's extension.
    const layout = readFileSync(join(root, "src/routes/admin.tsx"), "utf8");
    expect(layout).toContain('import content from "../../content.config"');
  });
});

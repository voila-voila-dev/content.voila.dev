import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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
    expect(result.files).not.toContain("dot-gitignore");
    expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain("node_modules");
  });

  test("substitutes {{projectName}} in package.json and config", async () => {
    await scaffold({ targetDir: dir, projectName: "my-blog" });
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    expect(pkg.name).toBe("my-blog");
    expect(readFileSync(join(dir, "content.config.ts"), "utf8")).toContain('name: "my-blog"');
  });

  test("scaffolds from a custom template directory", async () => {
    const result = await scaffold({ targetDir: dir, projectName: "x", templateDir: TEMPLATE_DIR });
    expect(result.files.length).toBeGreaterThan(0);
  });

  test("leaves no placeholder tokens behind", async () => {
    const result = await scaffold({
      targetDir: dir,
      projectName: "acme",
      clientDomain: "acme.dev",
    });
    for (const file of result.files) {
      const contents = readFileSync(join(dir, file), "utf8");
      expect(contents, file).not.toContain("{{projectName}}");
      expect(contents, file).not.toContain("{{authSecret}}");
      expect(contents, file).not.toContain("{{clientDomain}}");
      expect(contents, file).not.toContain("{{d1DatabaseId}}");
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

  test("wires a secure-by-default admin through @voila/content-admin", async () => {
    await scaffold({ targetDir: dir, projectName: "acme" });
    // The server runtime (auth + CSRF + access control) is built by the package.
    const server = readFileSync(join(dir, "app/lib/server.ts"), "utf8");
    expect(server).toContain("createWorkerAdmin");
    // The /api mount routes auth + REST + CSRF cookie.
    expect(readFileSync(join(dir, "app/routes/api.$.ts"), "utf8")).toContain("createApiHandler");
    // The login page + root guard layout + auth server fn ship.
    expect(existsSync(join(dir, "app/routes/login.tsx"))).toBe(true);
    expect(existsSync(join(dir, "app/routes/_app.tsx"))).toBe(true);
    expect(existsSync(join(dir, "app/lib/auth.ts"))).toBe(true);
    // The migrate script provisions the auth tables.
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.["migrate:generate"]).toContain("--auth");
  });

  test("ships the fixed dynamic $collection routes, not per-collection files", async () => {
    const result = await scaffold({ targetDir: dir, projectName: "acme" });
    // Root-mounted under a pathless `_app` layout (the admin is the whole site,
    // no `/admin` prefix).
    expect(result.files).toContain("app/routes/_app.$collection.index.tsx");
    expect(result.files).toContain("app/routes/_app.$collection.new.tsx");
    expect(result.files).toContain("app/routes/_app.$collection.$id.tsx");
    expect(result.files).toContain("app/routes/_app.$.tsx");
    // No per-collection route files — adding a collection needs no new file.
    expect(result.files.some((f) => f.includes(".posts."))).toBe(false);
  });

  test("ships a Cloudflare Worker config (one Worker · D1 · R2 · domain)", async () => {
    await scaffold({ targetDir: dir, projectName: "acme", clientDomain: "acme.dev" });
    const wrangler = readFileSync(join(dir, "wrangler.jsonc"), "utf8");
    expect(wrangler).toContain('"binding": "DB"');
    expect(wrangler).toContain('"binding": "BUCKET"');
    expect(wrangler).toContain('"custom_domain": true');
    expect(wrangler).toContain("admin.acme.dev");
    // A non-empty placeholder id so local `bun run dev` works out of the box
    // (replaced with the real id from `wrangler d1 create` before deploy).
    const id = JSON.parse(wrangler.replace(/\/\/.*$/gm, "")).d1_databases[0].database_id;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("clientDomain defaults to a placeholder when unset", async () => {
    await scaffold({ targetDir: dir, projectName: "acme" });
    expect(readFileSync(join(dir, "wrangler.jsonc"), "utf8")).toContain("admin.example.com");
  });
});

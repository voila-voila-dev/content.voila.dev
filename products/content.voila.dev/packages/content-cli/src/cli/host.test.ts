import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveSrcDirectory, retargetFiles, validateHost } from "./host";
import { CliError } from "./index";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "voila-host-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("validateHost", () => {
  it("throws on a missing directory", () => {
    expect(() => validateHost(join(dir, "nope"))).toThrow(CliError);
  });

  it("names every missing marker", () => {
    expect(() => validateHost(dir)).toThrow(/package\.json and content\.config\.ts/);
  });

  it("names only the marker that is missing", () => {
    writeFileSync(join(dir, "package.json"), "{}");
    expect(() => validateHost(dir)).toThrow(/missing content\.config\.ts/);
  });

  it("passes a directory with both markers", () => {
    writeFileSync(join(dir, "package.json"), "{}");
    writeFileSync(join(dir, "content.config.ts"), "export default { collections: {} };");
    expect(() => validateHost(dir)).not.toThrow();
  });
});

describe("resolveSrcDirectory", () => {
  it("reads srcDirectory from the vite config", () => {
    writeFileSync(join(dir, "vite.config.ts"), 'tanstackStart({ srcDirectory: "app" })');
    expect(resolveSrcDirectory(dir)).toBe("app");
  });

  it("normalizes a leading ./ on srcDirectory", () => {
    writeFileSync(join(dir, "vite.config.mts"), "tanstackStart({ srcDirectory: './source' })");
    expect(resolveSrcDirectory(dir)).toBe("source");
  });

  it("falls back to TanStack Start's src default when the option is absent", () => {
    writeFileSync(join(dir, "vite.config.js"), "tanstackStart()");
    expect(resolveSrcDirectory(dir)).toBe("src");
  });

  it("probes for src/routes when there is no vite config", () => {
    mkdirSync(join(dir, "src", "routes"), { recursive: true });
    expect(resolveSrcDirectory(dir)).toBe("src");
  });

  it("defaults to app when nothing else resolves", () => {
    expect(resolveSrcDirectory(dir)).toBe("app");
    writeFileSync(join(dir, "vite.config.mjs"), "export default {};");
    expect(resolveSrcDirectory(dir)).toBe("app");
  });
});

describe("retargetFiles", () => {
  const files = [
    { path: "app/lib/content-client.ts" },
    { path: "app/routes/admin.tsx", target: "app/routes/cms.tsx" },
    { path: "content.config.ts" },
  ];

  it("is the identity for the authored app/ layout", () => {
    expect(retargetFiles(files, "app")).toBe(files);
  });

  it("remaps app/ targets and leaves root-level files alone", () => {
    const targets = retargetFiles(files, "src").map((file) => file.target ?? file.path);
    expect(targets).toEqual([
      "src/lib/content-client.ts",
      "src/routes/cms.tsx",
      "content.config.ts",
    ]);
  });
});

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diffFiles, diffLines } from "./diff";

describe("diffLines", () => {
  test("all context when identical", () => {
    expect(diffLines("a\nb", "a\nb")).toEqual([
      { type: "ctx", text: "a" },
      { type: "ctx", text: "b" },
    ]);
  });

  test("marks an added line", () => {
    expect(diffLines("a\nb", "a\nx\nb")).toEqual([
      { type: "ctx", text: "a" },
      { type: "add", text: "x" },
      { type: "ctx", text: "b" },
    ]);
  });

  test("marks a removed line", () => {
    expect(diffLines("a\nx\nb", "a\nb")).toEqual([
      { type: "ctx", text: "a" },
      { type: "del", text: "x" },
      { type: "ctx", text: "b" },
    ]);
  });

  test("marks a replaced line as del then add", () => {
    expect(diffLines("a\nb\nc", "a\nB\nc")).toEqual([
      { type: "ctx", text: "a" },
      { type: "del", text: "b" },
      { type: "add", text: "B" },
      { type: "ctx", text: "c" },
    ]);
  });

  test("handles a fully empty-vs-content diff", () => {
    expect(diffLines("", "x")).toEqual([
      { type: "del", text: "" },
      { type: "add", text: "x" },
    ]);
  });

  test("preserves all local lines when upstream is a prefix", () => {
    const out = diffLines("a", "a\nb\nc");
    expect(out.filter((l) => l.type === "add").map((l) => l.text)).toEqual(["b", "c"]);
  });
});

describe("diffFiles", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "voila-diff-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("reports missing when the target was never vended", async () => {
    const out = await diffFiles([{ path: "app/lib/content-client.ts" }], { cwd: dir });
    expect(out).toEqual([{ target: "app/lib/content-client.ts", status: "missing" }]);
  });

  test("reports unchanged when the copy matches upstream", async () => {
    // Read the real upstream source and write it verbatim, then diff.
    const { readItemFile } = await import("./files");
    const file = { path: "app/lib/content-client.ts" };
    const upstream = await readItemFile(file);
    writeFileSync(join(dir, "content-client.ts"), upstream);
    const out = await diffFiles(
      [{ path: "app/lib/content-client.ts", target: "content-client.ts" }],
      {
        cwd: dir,
      },
    );
    expect(out[0]?.status).toBe("unchanged");
    expect(out[0]?.hunks).toBeUndefined();
  });

  test("reports modified with hunks when the copy drifted", async () => {
    writeFileSync(join(dir, "content-client.ts"), "// totally different\n");
    const out = await diffFiles(
      [{ path: "app/lib/content-client.ts", target: "content-client.ts" }],
      {
        cwd: dir,
      },
    );
    expect(out[0]?.status).toBe("modified");
    expect(out[0]?.hunks?.some((h) => h.type === "add" && h.text.includes("different"))).toBe(true);
  });
});

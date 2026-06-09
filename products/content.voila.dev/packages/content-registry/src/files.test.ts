import { describe, expect, test } from "bun:test";
import { ITEMS_DIR, itemSourcePath, readItemFile } from "./files";

describe("files", () => {
  test("itemSourcePath joins under the items dir", () => {
    const p = itemSourcePath({ path: "app/lib/content-client.ts" });
    expect(p.startsWith(ITEMS_DIR)).toBe(true);
    expect(p.endsWith("app/lib/content-client.ts")).toBe(true);
  });

  test("readItemFile returns the vended source text", async () => {
    const src = await readItemFile({ path: "app/lib/content-client.ts" });
    expect(src).toContain("makeClient");
    expect(src).toContain('baseUrl: "/admin/api"');
  });

  test("a target override does not change the source path", () => {
    // The source is always read from `path`; `target` only affects where it lands.
    const p = itemSourcePath({ path: "app/routes/admin.tsx", target: "src/routes/admin.tsx" });
    expect(p.endsWith("app/routes/admin.tsx")).toBe(true);
  });
});

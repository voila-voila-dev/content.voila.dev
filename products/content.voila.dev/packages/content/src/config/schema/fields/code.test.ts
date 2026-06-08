import { describe, expect, it } from "bun:test";
import { decodeSync } from "../std";
import { code } from "./code";

describe("fields.code", () => {
  it("defaults the language to plain", () => {
    const f = code();
    expect(decodeSync(f, "echo hi")).toBe("echo hi");
    expect(f.meta.kind).toBe("code");
    expect(f.meta.language).toBe("plain");
  });

  it("carries the configured language", () => {
    const f = code({ language: "ts" });
    expect(f.meta.language).toBe("ts");
  });
});

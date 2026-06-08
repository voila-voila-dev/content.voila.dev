import { describe, expect, it } from "bun:test";
import { decodeSync } from "../std";
import { password } from "./password";

describe("fields.password", () => {
  it("accepts a plaintext string and defaults to argon2id, hidden", () => {
    const f = password();
    expect(decodeSync(f, "hunter2")).toBe("hunter2");
    expect(f.meta.kind).toBe("password");
    expect(f.meta.hash).toBe("argon2id");
    expect(f.meta.hidden).toBe(true);
  });

  it("enforces a minimum length when given", () => {
    const f = password({ min: 8, hash: "bcrypt" });
    expect(decodeSync(f, "longenough")).toBe("longenough");
    expect(() => decodeSync(f, "short")).toThrow();
    expect(f.meta.hash).toBe("bcrypt");
  });
});

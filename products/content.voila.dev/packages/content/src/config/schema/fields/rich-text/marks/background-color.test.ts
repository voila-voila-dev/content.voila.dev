import { describe, expect, it } from "bun:test";
import { decodeSync } from "../../../std";
import { backgroundColor } from "./background-color";

describe("backgroundColor mark", () => {
  it("keys as `backgroundColor` and accepts a string", () => {
    expect(backgroundColor.key).toBe("backgroundColor");
    expect(decodeSync(backgroundColor.schema, "yellow")).toBe("yellow");
  });
});

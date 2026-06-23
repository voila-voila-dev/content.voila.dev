import { describe, expect, it } from "bun:test";
import { matchScreen } from "./match";

const screens = [
  { id: "analytics", path: "/analytics" },
  { id: "post-featured", path: "/posts/featured" },
  { id: "post-detail", path: "/posts/:id" },
  { id: "nested", path: "/reports/:year/:month" },
] as const;

describe("matchScreen", () => {
  it("matches a literal path", () => {
    expect(matchScreen(screens, "/analytics")?.screen.id).toBe("analytics");
  });

  it("ignores leading/trailing slashes", () => {
    expect(matchScreen(screens, "analytics/")?.screen.id).toBe("analytics");
  });

  it("captures a single param", () => {
    const m = matchScreen(screens, "/posts/abc123");
    expect(m?.screen.id).toBe("post-detail");
    expect(m?.params).toEqual({ id: "abc123" });
  });

  it("prefers a static path over a param path of the same shape", () => {
    expect(matchScreen(screens, "/posts/featured")?.screen.id).toBe("post-featured");
  });

  it("captures multiple params and decodes them", () => {
    const m = matchScreen(screens, "/reports/2024/q%201");
    expect(m?.screen.id).toBe("nested");
    expect(m?.params).toEqual({ year: "2024", month: "q 1" });
  });

  it("returns null when nothing matches", () => {
    expect(matchScreen(screens, "/nope")).toBeNull();
    expect(matchScreen(screens, "/posts/a/b")).toBeNull();
  });
});

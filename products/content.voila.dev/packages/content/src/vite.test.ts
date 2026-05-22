import { describe, expect, test } from "bun:test";
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

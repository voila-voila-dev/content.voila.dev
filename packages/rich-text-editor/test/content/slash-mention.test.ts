import { describe, expect, test } from "bun:test";
import { derivePlugins, deriveToolbar } from "../../src/content/capabilities.ts";
import { deriveSlashItems } from "../../src/slash.tsx";

function keysOf(elements: ReadonlyArray<string>, marks: ReadonlyArray<string>, opts?: object) {
  return derivePlugins(elements, marks, opts).plugins.map((p) => (p as { key: string }).key);
}

const FULL_ELEMENTS = ["paragraph", "heading-1", "heading-2", "blockquote", "bullet-list"];

describe("derivePlugins — slash menu", () => {
  test("`slash: true` wires the slash command + input plugins and registers the input component", () => {
    const { plugins, components } = derivePlugins(FULL_ELEMENTS, ["bold"], { slash: true });
    const keys = plugins.map((p) => (p as { key: string }).key);
    expect(keys).toContain("slash_command");
    expect(keys).toContain("slash_input");
    expect(components.slash_input).toBeDefined();
  });

  test("omitted by default", () => {
    expect(keysOf(FULL_ELEMENTS, ["bold"])).not.toContain("slash_command");
  });

  test("skipped when the field has no block/list commands (menu would be empty)", () => {
    // Only marks allowed → no blocks to turn into → no slash menu.
    const keys = keysOf([], ["bold", "italic"], { slash: true });
    expect(keys).not.toContain("slash_command");
    expect(keys).not.toContain("slash_input");
  });
});

describe("deriveSlashItems", () => {
  test("flattens a toolbar model's blocks then lists", () => {
    const model = deriveToolbar(FULL_ELEMENTS, ["bold"]);
    const items = deriveSlashItems(model);
    const wireTypes = items.map((i) => i.wireType);
    // blocks first…
    expect(wireTypes.slice(0, model.blocks.length)).toEqual(model.blocks.map((b) => b.wireType));
    // …then lists, and marks are never commands.
    expect(wireTypes).toContain("bullet-list");
    expect(wireTypes).not.toContain("bold");
  });

  test("empty when the field allows no blocks or lists", () => {
    expect(deriveSlashItems(deriveToolbar([], ["bold"]))).toHaveLength(0);
  });
});

describe("derivePlugins — mention", () => {
  const mention = { source: "users", items: [{ value: "ada", label: "Ada" }] };

  test("wires mention + mention_input plugins and components when the field allows `mention`", () => {
    const { plugins, components } = derivePlugins(["paragraph", "mention"], [], { mention });
    const keys = plugins.map((p) => (p as { key: string }).key);
    expect(keys).toContain("mention");
    expect(keys).toContain("mention_input");
    expect(components.mention).toBeDefined();
    expect(components.mention_input).toBeDefined();
  });

  test("not wired when the field omits the `mention` element kind", () => {
    const keys = keysOf(["paragraph"], [], { mention });
    expect(keys).not.toContain("mention");
    expect(keys).not.toContain("mention_input");
  });

  test("not wired when no source is supplied, even if `mention` is allowed", () => {
    const keys = keysOf(["paragraph", "mention"], []);
    expect(keys).not.toContain("mention_input");
  });
});

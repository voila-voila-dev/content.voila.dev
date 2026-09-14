import { describe, expect, it } from "bun:test";
import { str } from "../std";
import { fieldsStruct, humanizeKey, isField, walkFields } from "./_nested";
import { array } from "./array";
import { blocks } from "./blocks";
import { media } from "./media";
import { object } from "./object";
import { string } from "./string";

describe("isField", () => {
  it("tells a voila field from a bare validator", () => {
    expect(isField(string())).toBe(true);
    expect(isField(str())).toBe(false);
  });
});

describe("humanizeKey", () => {
  it("splits camel, snake and kebab case", () => {
    expect(humanizeKey("heroBanner")).toBe("Hero Banner");
    expect(humanizeKey("hero_banner")).toBe("Hero Banner");
    expect(humanizeKey("cta-banner")).toBe("Cta Banner");
  });
});

describe("fieldsStruct", () => {
  it("adds `extra` members and drops unknown keys", () => {
    const v = fieldsStruct({ title: string() }, { type: str() });
    const r = v["~standard"].validate({ type: "x", title: "t", junk: 1 });
    expect(r).toEqual({ value: { type: "x", title: "t" } });
  });

  it("rejects non-objects", () => {
    const v = fieldsStruct({ title: string() });
    expect(v["~standard"].validate([])).toEqual({
      issues: [{ message: "Expected an object" }],
    });
  });
});

describe("walkFields", () => {
  it("visits fields nested in arrays, objects and blocks with their path", () => {
    const seen: string[] = [];
    walkFields(
      {
        cover: media(),
        gallery: array(media()),
        seo: object({ image: media(), title: string() }),
        sections: blocks({ types: { hero: { fields: { image: media() } } } }),
      },
      (field, path) => {
        if (field.meta.kind === "media") seen.push(path.join("."));
      },
    );
    expect(seen).toEqual(["cover", "gallery.item", "seo.image", "sections.hero.image"]);
  });
});

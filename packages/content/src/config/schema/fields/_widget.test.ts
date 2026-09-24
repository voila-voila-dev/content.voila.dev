import { describe, expect, test } from "bun:test";
import { array } from "./array";
import { markdown } from "./markdown";
import { string } from "./string";

describe("widget option", () => {
  test("defaults to the kind's widget", () => {
    expect(string().meta.widget).toBe("string");
  });

  test("overrides the widget name on one field", () => {
    expect(string({ widget: "cdnImage" }).meta.widget).toBe("cdnImage");
    expect(markdown({ widget: "prose" }).meta.widget).toBe("prose");
  });

  test("applies to array items and to the array itself", () => {
    const gallery = array(string({ widget: "cdnImage" }), { widget: "cdnGallery" });
    expect(gallery.meta.widget).toBe("cdnGallery");
    expect(gallery.meta.item?.meta.widget).toBe("cdnImage");
  });

  test("keeps the widget on the inner field of a localized one", () => {
    const title = string({ localized: true, widget: "headline" });
    expect(title.meta.widget).toBe("headline");
    expect(title.inner?.meta.widget).toBe("headline");
  });
});

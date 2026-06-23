import { describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields } from "@voila/content";
import { defaultEditRegistry } from "@voila/content-ui";
import { defineAdmin } from "./define-admin";

const config = defineConfig({
  branding: { name: "Test" },
  collections: {
    posts: defineCollection({
      slug: "posts",
      fields: { title: fields.string({ required: true }) },
    }),
  },
});

describe("defineAdmin", () => {
  it("defaults to a root mount (empty basePath) and exposes a typed client", () => {
    const admin = defineAdmin({ config });
    expect(admin.basePath).toBe("");
    expect(admin.apiPath).toBe("/api");
    expect(typeof admin.client.posts.list).toBe("function");
    expect(typeof admin.mediaClient.upload).toBe("function");
  });

  it("derives apiPath from a custom basePath", () => {
    const admin = defineAdmin({ config, basePath: "/cms" });
    expect(admin.apiPath).toBe("/cms/api");
  });

  it("honours an explicit apiPath", () => {
    const admin = defineAdmin({ config, basePath: "/cms", apiPath: "/api/v2" });
    expect(admin.apiPath).toBe("/api/v2");
  });

  it("merges widget overrides over the content-ui defaults", () => {
    const Custom = () => null;
    const admin = defineAdmin({ config, widgets: { edit: { string: Custom } } });
    expect(admin.editWidgets.string).toBe(Custom);
    // A non-overridden kind keeps the default widget.
    expect(admin.editWidgets.boolean).toBe(defaultEditRegistry.boolean);
  });

  it("defaults screens/slots/nav to empty", () => {
    const admin = defineAdmin({ config });
    expect(admin.screens).toEqual([]);
    expect(admin.slots).toEqual({});
    expect(admin.nav).toBeUndefined();
  });
});

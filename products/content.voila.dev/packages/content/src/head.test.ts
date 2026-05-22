import { describe, expect, test } from "bun:test";
import { defineContent } from "./define.ts";
import { buildAdminHead, buildSetupHead } from "./head.ts";

describe("buildAdminHead", () => {
  test("emits title + viewport + mount metadata", () => {
    const content = defineContent({ branding: { name: "Acme CMS" } });
    const head = buildAdminHead(content);
    expect(head.meta).toContainEqual({ title: "Acme CMS" });
    expect(head.meta).toContainEqual({
      name: "viewport",
      content: "width=device-width, initial-scale=1",
    });
    expect(head.meta).toContainEqual({ name: "voila:mount-admin", content: "/admin" });
    expect(head.meta).toContainEqual({ name: "voila:mount-api", content: "/admin/api" });
  });

  test("omits links and styles when favicon and accent are unset", () => {
    const head = buildAdminHead(defineContent());
    expect(head.links).toBeUndefined();
    expect(head.styles).toBeUndefined();
  });

  test("emits favicon link when branding.favicon is set", () => {
    const content = defineContent({ branding: { favicon: "/fav.ico" } });
    const head = buildAdminHead(content);
    expect(head.links).toEqual([{ rel: "icon", href: "/fav.ico" }]);
  });

  test("emits accent style when branding.accent is set", () => {
    const content = defineContent({ branding: { accent: "#FF6A00" } });
    const head = buildAdminHead(content);
    expect(head.styles).toEqual([{ children: ":root { --voila-color-accent: #FF6A00; }" }]);
  });

  test("falls back to 'Voila' for the title when branding.name is unset", () => {
    const head = buildAdminHead(defineContent());
    expect(head.meta).toContainEqual({ title: "Voila" });
  });

  test("reflects custom mount paths", () => {
    const content = defineContent({ mount: { admin: "/studio", api: "/studio/api" } });
    const head = buildAdminHead(content);
    expect(head.meta).toContainEqual({ name: "voila:mount-admin", content: "/studio" });
    expect(head.meta).toContainEqual({ name: "voila:mount-api", content: "/studio/api" });
  });
});

describe("buildSetupHead", () => {
  test("emits 'Setup — <name>' title", () => {
    const content = defineContent({ branding: { name: "Acme CMS" } });
    const head = buildSetupHead(content);
    expect(head.meta).toContainEqual({ title: "Setup — Acme CMS" });
  });

  test("falls back to 'Setup — Voila' when branding.name is unset", () => {
    const head = buildSetupHead(defineContent());
    expect(head.meta).toContainEqual({ title: "Setup — Voila" });
  });
});

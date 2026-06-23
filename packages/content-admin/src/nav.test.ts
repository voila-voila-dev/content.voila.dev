import { describe, expect, it } from "bun:test";
import type { ComponentType } from "react";
import { buildExtraGroups } from "./nav";
import type { CustomScreen, CustomScreenProps } from "./types";

const Noop = (() => null) as ComponentType<CustomScreenProps>;

function screen(id: string, path: string, nav?: CustomScreen["nav"]): CustomScreen {
  return { id, path, component: Noop, nav };
}

describe("buildExtraGroups", () => {
  it("returns nothing when there are no nav screens or extras", () => {
    expect(buildExtraGroups({ screens: [screen("a", "/a")], basePath: "/admin" })).toEqual([]);
  });

  it("builds an href from basePath + screen path and marks the active item", () => {
    const groups = buildExtraGroups({
      screens: [screen("analytics", "/analytics", { label: "Analytics" })],
      basePath: "/admin",
      currentPath: "/admin/analytics",
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe("More");
    expect(groups[0]?.items[0]).toMatchObject({
      slug: "analytics",
      label: "Analytics",
      href: "/admin/analytics",
      isActive: true,
    });
  });

  it("groups by nav.group and sorts within a group by order", () => {
    const groups = buildExtraGroups({
      screens: [
        screen("b", "/b", { label: "B", group: "Insights", order: 2 }),
        screen("a", "/a", { label: "A", group: "Insights", order: 1 }),
      ],
      basePath: "/admin",
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe("Insights");
    expect(groups[0]?.items.map((i) => i.slug)).toEqual(["a", "b"]);
  });

  it("appends nav.extra links under their group", () => {
    const groups = buildExtraGroups({
      screens: [],
      nav: {
        extra: [
          {
            slug: "site",
            label: "View site",
            href: "https://example.com",
            isActive: false,
            kind: "collection",
            group: "Links",
          },
        ],
      },
      basePath: "/admin",
    });
    expect(groups[0]?.label).toBe("Links");
    expect(groups[0]?.items[0]?.label).toBe("View site");
  });
});

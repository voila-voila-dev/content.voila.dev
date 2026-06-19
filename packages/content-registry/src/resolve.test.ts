import { describe, expect, test } from "bun:test";
import { getItem, listItems, RegistryError, resolve } from "./resolve";
import type { Registry } from "./types";

const reg: Registry = {
  items: [
    {
      name: "a",
      type: "lib",
      title: "A",
      description: "",
      dependencies: { dep1: "^1.0.0" },
      files: [{ path: "a.ts" }],
    },
    {
      name: "b",
      type: "block",
      title: "B",
      description: "",
      dependencies: { dep2: "^2.0.0" },
      registryDependencies: ["a"],
      files: [{ path: "b.ts" }],
    },
    {
      name: "c",
      type: "route",
      title: "C",
      description: "",
      registryDependencies: ["b", "a"],
      files: [{ path: "c.ts" }],
    },
  ],
};

describe("getItem / listItems", () => {
  test("getItem finds by name or returns undefined", () => {
    expect(getItem(reg, "b")?.title).toBe("B");
    expect(getItem(reg, "nope")).toBeUndefined();
  });

  test("listItems returns all in catalog order, or filtered by type", () => {
    expect(listItems(reg).map((i) => i.name)).toEqual(["a", "b", "c"]);
    expect(listItems(reg, "route").map((i) => i.name)).toEqual(["c"]);
    expect(listItems(reg, "field")).toEqual([]);
  });
});

describe("resolve", () => {
  test("returns the requested item with no deps", () => {
    expect(resolve(reg, ["a"]).items.map((i) => i.name)).toEqual(["a"]);
  });

  test("emits dependencies before dependents", () => {
    expect(resolve(reg, ["c"]).items.map((i) => i.name)).toEqual(["a", "b", "c"]);
  });

  test("dedupes an item reached by several paths", () => {
    // c depends on both b and a, and b depends on a — a appears once.
    const names = resolve(reg, ["c"]).items.map((i) => i.name);
    expect(names.filter((n) => n === "a")).toHaveLength(1);
  });

  test("dedupes repeated names in the request", () => {
    expect(resolve(reg, ["a", "a", "b"]).items.map((i) => i.name)).toEqual(["a", "b"]);
  });

  test("merges npm dependencies across the plan", () => {
    expect(resolve(reg, ["c"]).dependencies).toEqual({ dep1: "^1.0.0", dep2: "^2.0.0" });
  });

  test("collects every file in the plan", () => {
    expect(resolve(reg, ["c"]).files.map((f) => f.path)).toEqual(["a.ts", "b.ts", "c.ts"]);
  });

  test("throws a listing error for an unknown item", () => {
    expect(() => resolve(reg, ["zzz"])).toThrow(RegistryError);
    expect(() => resolve(reg, ["zzz"])).toThrow(/Unknown registry item "zzz".*a, b, c/);
  });

  test("throws on an unknown registry dependency", () => {
    const broken: Registry = {
      items: [
        {
          name: "x",
          type: "lib",
          title: "",
          description: "",
          registryDependencies: ["ghost"],
          files: [],
        },
      ],
    };
    expect(() => resolve(broken, ["x"])).toThrow(/Unknown registry item "ghost"/);
  });

  test("detects a dependency cycle and names the trail", () => {
    const cyclic: Registry = {
      items: [
        {
          name: "p",
          type: "lib",
          title: "",
          description: "",
          registryDependencies: ["q"],
          files: [],
        },
        {
          name: "q",
          type: "lib",
          title: "",
          description: "",
          registryDependencies: ["p"],
          files: [],
        },
      ],
    };
    expect(() => resolve(cyclic, ["p"])).toThrow(/Dependency cycle: p → q → p/);
  });

  test("errors on conflicting versions for the same package", () => {
    const clash: Registry = {
      items: [
        {
          name: "m",
          type: "lib",
          title: "",
          description: "",
          dependencies: { x: "^1.0.0" },
          files: [],
        },
        {
          name: "n",
          type: "lib",
          title: "",
          description: "",
          dependencies: { x: "^2.0.0" },
          registryDependencies: ["m"],
          files: [],
        },
      ],
    };
    expect(() => resolve(clash, ["n"])).toThrow(/Conflicting versions for "x".*\^1.0.0.*\^2.0.0/);
  });

  test("errors when two unrelated items write the same target from different sources", () => {
    const clash: Registry = {
      items: [
        { name: "m", type: "lib", title: "", description: "", files: [{ path: "shared.ts" }] },
        {
          name: "n",
          type: "lib",
          title: "",
          description: "",
          files: [{ path: "other.ts", target: "shared.ts" }],
        },
      ],
    };
    expect(() => resolve(clash, ["m", "n"])).toThrow(/Two items write "shared.ts"/);
  });

  test("lets a dependent override a file it inherits from a dependency", () => {
    // The "flavored override" seam: `n` depends on `m` and overwrites the file
    // `m` owns. The dependent's source wins; no conflict.
    const override: Registry = {
      items: [
        { name: "m", type: "lib", title: "", description: "", files: [{ path: "widgets.ts" }] },
        {
          name: "n",
          type: "field",
          title: "",
          description: "",
          registryDependencies: ["m"],
          files: [{ path: "widgets.flavored.ts", target: "widgets.ts" }],
        },
      ],
    };
    const files = resolve(override, ["n"]).files;
    expect(files.map((f) => f.path)).toEqual(["widgets.flavored.ts"]);
    expect(files.map((f) => f.target)).toEqual(["widgets.ts"]);
    // Resolving both together (the integrity check's "resolve all" case) is fine.
    expect(() => resolve(override, ["m", "n"])).not.toThrow();
  });

  test("a shared target from the same source is fine (deduped)", () => {
    const shared: Registry = {
      items: [
        { name: "m", type: "lib", title: "", description: "", files: [{ path: "shared.ts" }] },
        {
          name: "n",
          type: "lib",
          title: "",
          description: "",
          registryDependencies: ["m"],
          files: [{ path: "shared.ts" }],
        },
      ],
    };
    expect(resolve(shared, ["n"]).files.map((f) => f.path)).toEqual(["shared.ts"]);
  });
});

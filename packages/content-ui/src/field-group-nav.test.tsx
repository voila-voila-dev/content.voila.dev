import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FieldGroupNav, resolveGroupIcon } from "./field-group-nav";
import type { ResolvedGroup } from "./lib/groups";

afterEach(cleanup);

const groups: ResolvedGroup[] = [
  { id: "content", label: "Content", icon: "FileText", fieldKeys: ["title"] },
  { id: "meta", label: "Metadata", fieldKeys: ["seo"] },
  { id: "broken", label: "Broken", icon: "NotARealIconName", fieldKeys: ["x"] },
];

describe("resolveGroupIcon", () => {
  test("resolves a known Phosphor name and tolerates the …Icon suffix", () => {
    expect(resolveGroupIcon("FileText")).toBeDefined();
    expect(resolveGroupIcon("FileTextIcon")).toBeDefined();
  });
  test("returns undefined for unknown or missing names", () => {
    expect(resolveGroupIcon("NotARealIconName")).toBeUndefined();
    expect(resolveGroupIcon(undefined)).toBeUndefined();
  });
});

describe("FieldGroupNav", () => {
  test("renders one button per group with the active one marked", () => {
    render(<FieldGroupNav groups={groups} activeGroup="meta" onSelect={() => {}} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Content", "Metadata", "Broken"]);
    expect(screen.getByRole("button", { name: "Metadata" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByRole("button", { name: "Content" }).getAttribute("aria-current")).toBeNull();
  });

  test("renders an icon for a known name and none for an unknown one", () => {
    render(<FieldGroupNav groups={groups} activeGroup="content" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "Content" }).querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Broken" }).querySelector("svg")).toBeNull();
  });

  test("invokes onSelect with the group id on click", () => {
    let selected = "";
    render(
      <FieldGroupNav groups={groups} activeGroup="content" onSelect={(id) => (selected = id)} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Metadata" }));
    expect(selected).toBe("meta");
  });
});

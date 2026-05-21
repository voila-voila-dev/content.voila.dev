import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "@voila/ui";
import * as Icons from "@voila/ui/icons";
import type { ComponentType } from "react";
import { useMemo, useState } from "react";

const meta: Meta = {
  title: "Foundations/Icons",
  parameters: { layout: "fullscreen" },
};

export default meta;

type Weight = "regular" | "thin" | "light" | "bold" | "duotone" | "fill";
type IconComponent = ComponentType<{ className?: string; weight?: Weight }>;

const ICON_ENTRIES: Array<[string, IconComponent]> = Object.entries(Icons)
  .filter(([name, value]) => {
    if (!name.endsWith("Icon")) return false;
    return typeof value === "object" || typeof value === "function";
  })
  .map(([name, value]) => [name, value as unknown as IconComponent]);

function Gallery({ weight }: { weight: Weight }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ICON_ENTRIES;
    return ICON_ENTRIES.filter(([name]) => name.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">@voila/ui/icons</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} icons (Phosphor re-export, weight: {weight})
          </p>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search icons…"
          className="w-64"
        />
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
        {filtered.map(([name, Icon]) => (
          <div
            key={name}
            className="group flex flex-col items-center gap-2 rounded-md border bg-card p-3 text-card-foreground"
          >
            <Icon weight={weight} className="h-6 w-6" />
            <span className="line-clamp-1 max-w-full text-center text-[11px] text-muted-foreground">
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const Regular: StoryObj = { render: () => <Gallery weight="regular" /> };
export const Bold: StoryObj = { render: () => <Gallery weight="bold" /> };
export const Duotone: StoryObj = { render: () => <Gallery weight="duotone" /> };
export const Fill: StoryObj = { render: () => <Gallery weight="fill" /> };

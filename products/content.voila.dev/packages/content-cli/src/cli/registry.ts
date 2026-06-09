// `voila list` — browse the registry catalog of vendable items. Groups items by
// type and prints each name, title, and description; an optional `--type` scopes
// the listing. The catalog and its filtering live in `@voila/content-registry`;
// this file only parses flags and formats the output.

import { parseArgs } from "node:util";
import {
  listItems,
  type RegistryItem,
  type RegistryItemType,
  registry,
} from "@voila/content-registry";
import { CliError } from "./index";

const TYPES = ["shell", "route", "block", "field", "lib"] as const;

export async function runList(args: ReadonlyArray<string>): Promise<void> {
  const { values } = parseArgs({
    args: [...args],
    options: { type: { type: "string" } },
    strict: true,
  });

  const type = values.type as string | undefined;
  if (type !== undefined && !TYPES.includes(type as RegistryItemType)) {
    throw new CliError(`Invalid --type "${type}". Expected one of: ${TYPES.join(", ")}.`);
  }

  const items = listItems(registry, type as RegistryItemType | undefined);
  if (items.length === 0) {
    console.log(type ? `No registry items of type "${type}".` : "The registry is empty.");
    return;
  }

  console.log(formatCatalog(items));
}

/** Render items grouped into type sections (in `TYPES` order); within a section
 *  items keep their catalog order. */
function formatCatalog(items: ReadonlyArray<RegistryItem>): string {
  const sections: string[] = [];
  for (const type of TYPES) {
    const group = items.filter((item) => item.type === type);
    if (group.length === 0) continue;
    const lines = [`${type}:`];
    for (const item of group) {
      lines.push(`  ${item.name}  —  ${item.title}`);
      lines.push(`      ${item.description}`);
    }
    sections.push(lines.join("\n"));
  }
  return sections.join("\n\n");
}

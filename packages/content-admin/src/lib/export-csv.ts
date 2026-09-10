// Export rows as CSV — the "get my content out" escape hatch every admin needs
// and the one bulk action that is always safe to offer.
//
// Values are flattened for a spreadsheet, not round-tripped: a localized record
// exports its default locale, a geo point exports "lat, lng", a rich-text
// document exports its plain text, and anything else structural exports as
// compact JSON. That makes the file readable in Excel, which is what it is for.

import type { Collection, Field } from "@voila/content";

/** RFC 4180 quoting: wrap when the value could confuse a parser, double inner quotes. */
function csvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

/** Concatenated leaf text of a rich-text node tree. */
function richTextText(node: unknown): string {
  if (node === null || typeof node !== "object") return "";
  const n = node as { text?: unknown; children?: unknown };
  if (typeof n.text === "string") return n.text;
  if (Array.isArray(n.children)) return n.children.map(richTextText).join("");
  return "";
}

/** One field value, flattened to something a spreadsheet cell can hold. */
export function csvValue(value: unknown, field: Field | undefined, defaultLocale?: string): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const kind = field?.meta.kind;
  if (kind === "richText") {
    return Array.isArray(value) ? value.map(richTextText).join("\n").trim() : "";
  }
  if (field?.meta.localized === true && !Array.isArray(value) && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferred = defaultLocale === undefined ? undefined : record[defaultLocale];
    if (typeof preferred === "string") return preferred;
    const first = Object.values(record).find((v) => typeof v === "string");
    return typeof first === "string" ? first : JSON.stringify(value);
  }
  if (kind === "geo" && typeof value === "object" && !Array.isArray(value)) {
    const { lat, lng } = value as { lat?: unknown; lng?: unknown };
    if (typeof lat === "number" && typeof lng === "number") return `${lat}, ${lng}`;
  }
  if (Array.isArray(value))
    return value.map((v) => csvValue(v, undefined, defaultLocale)).join("; ");
  return JSON.stringify(value);
}

export interface BuildCsvOptions {
  readonly collection: Collection;
  /** Column order. Defaults to `id` plus every non-hidden field. */
  readonly fields?: ReadonlyArray<string>;
  readonly defaultLocale?: string;
}

/** Render rows as a CSV document, header row included. */
export function buildCsv(
  rows: ReadonlyArray<Record<string, unknown>>,
  options: BuildCsvOptions,
): string {
  const { collection, defaultLocale } = options;
  const keys =
    options.fields ??
    Object.keys(collection.fields).filter((k) => collection.fields[k]?.meta.hidden !== true);
  const columns = ["id", ...keys];
  const header = columns.map(csvCell).join(",");
  const body = rows.map((row) =>
    columns
      .map((key) => csvCell(csvValue(row[key], collection.fields[key], defaultLocale)))
      .join(","),
  );
  return [header, ...body].join("\r\n");
}

/**
 * Hand the CSV to the browser as a download. Kept separate from `buildCsv` so
 * the string builder stays pure and testable; this half only runs in a browser.
 */
export function downloadCsv(csv: string, filename: string): void {
  // A BOM makes Excel read the file as UTF-8 rather than the system codepage —
  // without it, accented titles arrive mangled.
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  // `appendChild`, not `append`: under the Cloudflare Workers typings the demo
  // app compiles with, the global `append` resolves to a Workers overload that
  // only accepts a Response/stream, so `append(anchor)` fails to typecheck.
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** `films-2026-09-10.csv` — collection slug plus the day, so files sort. */
export function csvFilename(slug: string, now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return `${slug}-${day}.csv`;
}

// The read layer. Everything the public site renders comes through here.
//
// Data flow: D1 binding → `makeD1Driver` → `makeDatabase(config, driver)` →
// `localizeDocument(fields, doc, localeChain(...))` → a typed, single-locale
// document. There is no HTTP hop and no REST mount: the site runs in the same
// Worker as the database binding, so it reads the engine's `Database` service
// directly (the same service the REST layer and the admin's Durable Object sit
// on top of). The document shapes are still derived from the one schema —
// `InferLocalizedDoc<typeof config, "films">` — so this file is type-checked
// against `content.config.ts` with no codegen.
//
// This module is server-only (it imports `cloudflare:workers`); it is reached
// exclusively from the `createServerFn` handlers in `./queries`.

import { env } from "cloudflare:workers";
import {
  type InferLocalizedDoc,
  type InferLocalizedSingleton,
  localeChain,
  localizeDocument,
} from "@voila/content";
import { type Database, type Document, makeD1Driver, makeDatabase } from "@voila/content/server";
import config from "../../content.config";
import { DEFAULT_LOCALE, type Lang } from "./i18n";

// ── Document shapes ─────────────────────────────────────────────────────────
// `InferLocalizedDoc` is the shape of a `?locale=` read: every localized field
// already flattened to one locale's value (possibly `undefined` — we allow
// partial translations, and the locale chain falls back to en-US). System
// columns aren't part of the field map, so they're spelled out once here.

interface SystemColumns {
  readonly id: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/**
 * A `datetime` field *decodes* to a `Date`, but its canonical stored form — and
 * the form it crosses the server-function boundary in — is epoch milliseconds.
 * These documents are read straight off the `Database` (no field decode) and
 * then JSON-serialized to the browser, so timestamps are numbers the whole way.
 */
type Wire<T> = { readonly [K in keyof T]: Date extends T[K] ? Exclude<T[K], Date> | number : T[K] };

export type Film = Wire<InferLocalizedDoc<typeof config, "films">> & SystemColumns;
export type Screening = Wire<InferLocalizedDoc<typeof config, "screenings">> & SystemColumns;
export type Person = Wire<InferLocalizedDoc<typeof config, "people">> & SystemColumns;
export type JournalEntry = Wire<InferLocalizedDoc<typeof config, "journal">> & SystemColumns;
export type Settings = Wire<InferLocalizedSingleton<typeof config, "settings">> & SystemColumns;

/** Films the public may see — `draft` never leaves the programming desk. */
const PUBLIC_FILM_STATUS = new Set(["programmed", "showing"]);
/** The only screening status that belongs on a public calendar. */
const PUBLIC_SCREENING_STATUS = "on-sale";
/** The only journal status that belongs on a public page. */
const PUBLIC_JOURNAL_STATUS = "published";

/** Nothing on this site paginates; one page of 100 covers a season comfortably. */
const PAGE = 100;

function database(): Database {
  return makeDatabase(config, makeD1Driver(env.DB));
}

/**
 * Every read funnels through here so a cold or unprovisioned database degrades
 * into an empty page instead of a 500. The public site is a read-only consumer
 * of a database it does not own — if the content tables aren't there yet, the
 * cinema simply has nothing to announce.
 */
async function safely<T>(what: string, read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    console.error(`[vertigo] read failed: ${what}`, error);
    return fallback;
  }
}

/** Flatten one raw row to a single locale, following the fallback chain. */
function localize<T>(collection: keyof typeof config.collections, doc: Document, lang: Lang): T {
  const fields = config.collections[collection].fields;
  const chain = localeChain(
    config.i18n ?? { locales: [DEFAULT_LOCALE], defaultLocale: DEFAULT_LOCALE },
    lang,
  );
  return localizeDocument(fields, doc, chain) as unknown as T;
}

function localizeSettings(doc: Document, lang: Lang): Settings {
  const chain = localeChain(
    config.i18n ?? { locales: [DEFAULT_LOCALE], defaultLocale: DEFAULT_LOCALE },
    lang,
  );
  return localizeDocument(config.singletons.settings.fields, doc, chain) as unknown as Settings;
}

// ── Collection reads ────────────────────────────────────────────────────────

export async function readSettings(lang: Lang): Promise<Settings | null> {
  return safely(
    "settings",
    async () => {
      const doc = await database().get("settings", "settings");
      return doc ? localizeSettings(doc, lang) : null;
    },
    null,
  );
}

/** Every film the public may see, newest-first by year then title. */
export async function readFilms(lang: Lang): Promise<Film[]> {
  return safely("films", async () => {
    const { documents } = await database().list("films", { limit: PAGE, orderBy: "id" });
    return documents
      .filter((doc) => PUBLIC_FILM_STATUS.has(String(doc.status ?? "")))
      .map((doc) => localize<Film>("films", doc, lang))
      .sort(byYearThenTitle);
  }, []);
}

function byYearThenTitle(a: Film, b: Film): number {
  const ya = typeof a.year === "number" ? a.year : 0;
  const yb = typeof b.year === "number" ? b.year : 0;
  if (ya !== yb) return yb - ya;
  return (a.title ?? "").localeCompare(b.title ?? "");
}

export async function readFilmBySlug(slug: string, lang: Lang): Promise<Film | null> {
  return safely(
    `films/${slug}`,
    async () => {
      const doc = await database().findOne("films", "slug", slug);
      if (!doc || !PUBLIC_FILM_STATUS.has(String(doc.status ?? ""))) return null;
      return localize<Film>("films", doc, lang);
    },
    null,
  );
}

/** On-sale screenings, chronologically. `from` defaults to now (upcoming only). */
export async function readScreenings(lang: Lang, from = Date.now()): Promise<Screening[]> {
  return safely("screenings", async () => {
    const { documents } = await database().list("screenings", {
      limit: PAGE,
      orderBy: "startsAt",
      direction: "asc",
      filters: [{ field: "status", op: "eq", value: PUBLIC_SCREENING_STATUS }],
    });
    return documents
      .map((doc) => localize<Screening>("screenings", doc, lang))
      .filter((s) => typeof s.startsAt === "number" && s.startsAt >= from)
      .sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0));
  }, []);
}

export async function readPeople(lang: Lang): Promise<Person[]> {
  return safely("people", async () => {
    const { documents } = await database().list("people", { limit: PAGE });
    return documents.map((doc) => localize<Person>("people", doc, lang));
  }, []);
}

export async function readPersonBySlug(slug: string, lang: Lang): Promise<Person | null> {
  return safely(
    `people/${slug}`,
    async () => {
      const doc = await database().findOne("people", "slug", slug);
      return doc ? localize<Person>("people", doc, lang) : null;
    },
    null,
  );
}

/** Published journal entries, newest first. */
export async function readJournal(lang: Lang): Promise<JournalEntry[]> {
  return safely("journal", async () => {
    const { documents } = await database().list("journal", {
      limit: PAGE,
      filters: [{ field: "status", op: "eq", value: PUBLIC_JOURNAL_STATUS }],
    });
    return documents
      .map((doc) => localize<JournalEntry>("journal", doc, lang))
      .sort((a, b) => (b.publishedAt ?? b.createdAt) - (a.publishedAt ?? a.createdAt));
  }, []);
}

export async function readEntryBySlug(slug: string, lang: Lang): Promise<JournalEntry | null> {
  return safely(
    `journal/${slug}`,
    async () => {
      const doc = await database().findOne("journal", "slug", slug);
      if (!doc || String(doc.status ?? "") !== PUBLIC_JOURNAL_STATUS) return null;
      return localize<JournalEntry>("journal", doc, lang);
    },
    null,
  );
}

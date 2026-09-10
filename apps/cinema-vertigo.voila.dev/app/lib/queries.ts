// The page payloads.
//
// Each export is a `createServerFn` — it runs in the Worker on SSR and over a
// small RPC on client navigation, which is what keeps `./content` (and its
// `cloudflare:workers` binding import) out of the browser bundle. Relations are
// resolved here, on the server, so a page component receives ready-to-render
// data instead of a graph of ids: one read per collection per page, then an
// in-memory join — never a per-row round trip.

import { createServerFn } from "@tanstack/react-start";
import {
  type Film,
  type JournalEntry,
  type Person,
  readEntryBySlug,
  readFilmBySlug,
  readFilms,
  readJournal,
  readPeople,
  readPersonBySlug,
  readScreenings,
  readSettings,
  type Screening,
  type Settings,
} from "./content";
import { dayKey } from "./format";
import { DEFAULT_LOCALE, isLang, type Lang } from "./i18n";

// ── View models ─────────────────────────────────────────────────────────────
// Deliberately narrow: only what a template renders, all JSON-serializable.

/**
 * A rich-text document as it leaves the database: a tree of plain JSON. Typed
 * structurally (rather than as `unknown`, or as the engine's `rt.RichTextValue`
 * whose leaves carry an open `unknown` mark index) because a server function's
 * return type has to prove it is serializable.
 */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type RichTextDoc = ReadonlyArray<Json>;

export interface SiteSettings {
  readonly siteName: string;
  readonly tagline: string | null;
  readonly primaryColor: string | null;
  readonly about: RichTextDoc | null;
  readonly logo: string | null;
  readonly address: string | null;
  readonly openingHours: string | null;
  readonly contactEmail: string | null;
  readonly instagram: string | null;
  readonly location: { readonly lat: number; readonly lng: number } | null;
}

export interface FilmCard {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly originalTitle: string | null;
  readonly synopsis: string | null;
  readonly year: number | null;
  readonly runtime: number | null;
  readonly country: string | null;
  readonly certificate: string | null;
  readonly accentColor: string | null;
  readonly poster: string | null;
  readonly featured: boolean;
}

export interface FilmDetail extends FilmCard {
  readonly notes: RichTextDoc | null;
  readonly still: string | null;
  readonly formats: ReadonlyArray<string>;
  readonly trailerUrl: string | null;
  readonly shotIn: { readonly lat: number; readonly lng: number } | null;
}

export interface PersonRef {
  readonly slug: string;
  readonly name: string;
  readonly role: string | null;
}

export interface PersonDetail extends PersonRef {
  readonly bio: RichTextDoc | null;
  readonly portrait: string | null;
  readonly website: string | null;
  readonly bornIn: { readonly lat: number; readonly lng: number } | null;
}

export interface ScreeningCard {
  readonly id: string;
  readonly startsAt: number;
  readonly screen: string | null;
  readonly presentation: string | null;
  readonly soldOut: boolean;
  readonly ticketUrl: string | null;
  readonly note: string | null;
  readonly host: PersonRef | null;
  readonly film: FilmCard | null;
  /** Falls back to the screening's own label when the relation is missing. */
  readonly label: string;
}

export interface DayGroup {
  readonly key: string;
  readonly startsAt: number;
  readonly screenings: ReadonlyArray<ScreeningCard>;
}

export interface EntryCard {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string | null;
  readonly publishedAt: number | null;
  readonly tags: ReadonlyArray<string>;
  readonly cover: string | null;
  readonly author: PersonRef | null;
}

export interface EntryDetail extends EntryCard {
  readonly body: RichTextDoc | null;
  readonly aboutFilm: FilmCard | null;
}

// ── Mappers ─────────────────────────────────────────────────────────────────

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function point(value: unknown): { lat: number; lng: number } | null {
  if (typeof value !== "object" || value === null) return null;
  const { lat, lng } = value as { lat?: unknown; lng?: unknown };
  return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
}

/** A `media` value is `{ id, url, mime, … }`; only the URL reaches a template. */
function mediaUrl(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  return text((value as { url?: unknown }).url);
}

/** A rich-text value, or null when the field was never filled. */
function richText(value: unknown): RichTextDoc | null {
  return Array.isArray(value) && value.length > 0 ? (value as RichTextDoc) : null;
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toSettings(doc: Settings | null): SiteSettings | null {
  if (!doc) return null;
  return {
    siteName: text(doc.siteName) ?? "Cinéma Vertigo",
    tagline: text(doc.tagline),
    primaryColor: text(doc.primaryColor),
    about: richText(doc.about),
    logo: mediaUrl(doc.logo),
    address: text(doc.address),
    openingHours: text(doc.openingHours),
    contactEmail: text(doc.contactEmail),
    instagram: text(doc.instagram),
    location: point(doc.location),
  };
}

function toFilmCard(doc: Film): FilmCard {
  return {
    id: doc.id,
    slug: text(doc.slug) ?? doc.id,
    title: text(doc.title) ?? "Untitled",
    originalTitle: text(doc.originalTitle),
    synopsis: text(doc.synopsis),
    year: num(doc.year),
    runtime: num(doc.runtime),
    country: text(doc.country),
    certificate: text(doc.certificate),
    accentColor: text(doc.accentColor),
    poster: mediaUrl(doc.poster),
    featured: doc.featured === true,
  };
}

function toFilmDetail(doc: Film): FilmDetail {
  return {
    ...toFilmCard(doc),
    notes: richText(doc.notes),
    still: mediaUrl(doc.still),
    formats: list(doc.formats),
    trailerUrl: text(doc.trailerUrl),
    shotIn: point(doc.shotIn),
  };
}

function toPersonRef(doc: Person): PersonRef {
  return {
    slug: text(doc.slug) ?? doc.id,
    name: text(doc.name) ?? "—",
    role: text(doc.role),
  };
}

function toPersonDetail(doc: Person): PersonDetail {
  return {
    ...toPersonRef(doc),
    bio: richText(doc.bio),
    portrait: mediaUrl(doc.portrait),
    website: text(doc.website),
    bornIn: point(doc.bornIn),
  };
}

function toEntryCard(doc: JournalEntry, people: ReadonlyMap<string, Person>): EntryCard {
  const author = typeof doc.author === "string" ? people.get(doc.author) : undefined;
  return {
    id: doc.id,
    slug: text(doc.slug) ?? doc.id,
    title: text(doc.title) ?? "Untitled",
    excerpt: text(doc.excerpt),
    publishedAt: num(doc.publishedAt),
    tags: list(doc.tags),
    cover: mediaUrl(doc.cover),
    author: author ? toPersonRef(author) : null,
  };
}

function toScreeningCard(
  doc: Screening,
  films: ReadonlyMap<string, Film>,
  people: ReadonlyMap<string, Person>,
): ScreeningCard {
  const film = typeof doc.film === "string" ? films.get(doc.film) : undefined;
  const host = typeof doc.host === "string" ? people.get(doc.host) : undefined;
  return {
    id: doc.id,
    startsAt: typeof doc.startsAt === "number" ? doc.startsAt : 0,
    screen: text(doc.screen),
    presentation: text(doc.presentation),
    soldOut: doc.soldOut === true,
    ticketUrl: text(doc.ticketUrl),
    note: text(doc.note),
    host: host ? toPersonRef(host) : null,
    film: film ? toFilmCard(film) : null,
    label: film ? (text(film.title) ?? doc.label) : doc.label,
  };
}

/** Screenings → one entry per calendar day (Lisbon), in order. */
function groupByDay(screenings: ReadonlyArray<ScreeningCard>): DayGroup[] {
  const days = new Map<string, ScreeningCard[]>();
  for (const screening of screenings) {
    const key = dayKey(screening.startsAt);
    const bucket = days.get(key);
    if (bucket) bucket.push(screening);
    else days.set(key, [screening]);
  }
  return [...days.entries()]
    .map(([key, items]) => ({
      key,
      startsAt: items[0]?.startsAt ?? 0,
      screenings: items,
    }))
    .sort((a, b) => a.startsAt - b.startsAt);
}

function index<T extends { id: string }>(docs: ReadonlyArray<T>): Map<string, T> {
  return new Map(docs.map((doc) => [doc.id, doc]));
}

/** The `?lang` search param, validated back down to a supported locale. */
function toLang(value: unknown): Lang {
  return isLang(value) ? value : DEFAULT_LOCALE;
}

interface LangInput {
  readonly lang: Lang;
}
interface SlugInput extends LangInput {
  readonly slug: string;
}

const langInput = (data: LangInput): LangInput => ({ lang: toLang(data.lang) });
const slugInput = (data: SlugInput): SlugInput => ({
  lang: toLang(data.lang),
  slug: String(data.slug),
});

// ── Server functions ────────────────────────────────────────────────────────

/** Header/footer chrome. Fetched once by the root route. */
export const fetchSite = createServerFn({ method: "GET" })
  .validator(langInput)
  .handler(async ({ data }): Promise<{ settings: SiteSettings | null }> => {
    return { settings: toSettings(await readSettings(data.lang)) };
  });

export interface HomePayload {
  readonly week: ReadonlyArray<DayGroup>;
  readonly featured: ReadonlyArray<FilmCard>;
  readonly latest: EntryCard | null;
  readonly settings: SiteSettings | null;
}

/** The marquee: the next seven days, three featured films, the latest entry. */
export const fetchHome = createServerFn({ method: "GET" })
  .validator(langInput)
  .handler(async ({ data }): Promise<HomePayload> => {
    const { lang } = data;
    const now = Date.now();
    const [films, people, screenings, journal, settings] = await Promise.all([
      readFilms(lang),
      readPeople(lang),
      readScreenings(lang, now),
      readJournal(lang),
      readSettings(lang),
    ]);
    const filmIndex = index(films);
    const peopleIndex = index(people);
    const horizon = now + 7 * 86_400_000;
    const week = groupByDay(
      screenings
        .filter((s) => s.startsAt <= horizon)
        .map((s) => toScreeningCard(s, filmIndex, peopleIndex)),
    );
    const cards = films.map(toFilmCard);
    const featured = cards.filter((f) => f.featured);
    return {
      week,
      featured: (featured.length > 0 ? featured : cards).slice(0, 3),
      latest: journal[0] ? toEntryCard(journal[0], peopleIndex) : null,
      settings: toSettings(settings),
    };
  });

export interface ProgrammePayload {
  readonly days: ReadonlyArray<DayGroup>;
  readonly screens: ReadonlyArray<string>;
}

/** Every announced screening, grouped by date, plus the screens in play. */
export const fetchProgramme = createServerFn({ method: "GET" })
  .validator(langInput)
  .handler(async ({ data }): Promise<ProgrammePayload> => {
    const { lang } = data;
    const [films, people, screenings] = await Promise.all([
      readFilms(lang),
      readPeople(lang),
      readScreenings(lang),
    ]);
    const filmIndex = index(films);
    const peopleIndex = index(people);
    const cards = screenings.map((s) => toScreeningCard(s, filmIndex, peopleIndex));
    const screens = [...new Set(cards.map((s) => s.screen).filter((s): s is string => s !== null))];
    return { days: groupByDay(cards), screens };
  });

/** The catalogue. */
export const fetchFilms = createServerFn({ method: "GET" })
  .validator(langInput)
  .handler(async ({ data }): Promise<{ films: ReadonlyArray<FilmCard> }> => {
    return { films: (await readFilms(data.lang)).map(toFilmCard) };
  });

export interface FilmPayload {
  readonly film: FilmDetail;
  readonly director: PersonRef | null;
  readonly screenings: ReadonlyArray<ScreeningCard>;
  readonly entries: ReadonlyArray<EntryCard>;
}

/** One film: its credits, its note, its upcoming dates, and what we wrote. */
export const fetchFilm = createServerFn({ method: "GET" })
  .validator(slugInput)
  .handler(async ({ data }): Promise<FilmPayload | null> => {
    const { lang, slug } = data;
    const film = await readFilmBySlug(slug, lang);
    if (!film) return null;
    const [people, screenings, journal] = await Promise.all([
      readPeople(lang),
      readScreenings(lang),
      readJournal(lang),
    ]);
    const peopleIndex = index(people);
    const filmIndex = new Map([[film.id, film]]);
    const director = typeof film.director === "string" ? peopleIndex.get(film.director) : undefined;
    return {
      film: toFilmDetail(film),
      director: director ? toPersonRef(director) : null,
      screenings: screenings
        .filter((s) => s.film === film.id)
        .map((s) => toScreeningCard(s, filmIndex, peopleIndex)),
      entries: journal
        .filter((entry) => entry.aboutFilm === film.id)
        .map((entry) => toEntryCard(entry, peopleIndex)),
    };
  });

/** The writing. */
export const fetchJournal = createServerFn({ method: "GET" })
  .validator(langInput)
  .handler(async ({ data }): Promise<{ entries: ReadonlyArray<EntryCard> }> => {
    const [journal, people] = await Promise.all([readJournal(data.lang), readPeople(data.lang)]);
    const peopleIndex = index(people);
    return { entries: journal.map((entry) => toEntryCard(entry, peopleIndex)) };
  });

export const fetchEntry = createServerFn({ method: "GET" })
  .validator(slugInput)
  .handler(async ({ data }): Promise<{ entry: EntryDetail } | null> => {
    const { lang, slug } = data;
    const entry = await readEntryBySlug(slug, lang);
    if (!entry) return null;
    const [people, films] = await Promise.all([readPeople(lang), readFilms(lang)]);
    const peopleIndex = index(people);
    const about =
      typeof entry.aboutFilm === "string" ? index(films).get(entry.aboutFilm) : undefined;
    return {
      entry: {
        ...toEntryCard(entry, peopleIndex),
        body: richText(entry.body),
        aboutFilm: about ? toFilmCard(about) : null,
      },
    };
  });

export interface PersonPayload {
  readonly person: PersonDetail;
  readonly films: ReadonlyArray<FilmCard>;
  readonly entries: ReadonlyArray<EntryCard>;
}

/** One person, and everything in the catalogue that points at them. */
export const fetchPerson = createServerFn({ method: "GET" })
  .validator(slugInput)
  .handler(async ({ data }): Promise<PersonPayload | null> => {
    const { lang, slug } = data;
    const person = await readPersonBySlug(slug, lang);
    if (!person) return null;
    const [films, journal, people] = await Promise.all([
      readFilms(lang),
      readJournal(lang),
      readPeople(lang),
    ]);
    const peopleIndex = index(people);
    return {
      person: toPersonDetail(person),
      films: films.filter((film) => film.director === person.id).map(toFilmCard),
      entries: journal
        .filter((entry) => entry.author === person.id)
        .map((entry) => toEntryCard(entry, peopleIndex)),
    };
  });

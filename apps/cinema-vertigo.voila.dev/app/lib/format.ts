// Date/number formatting. Every formatter pins `timeZone: TIME_ZONE`, so the
// Worker (UTC) and the visitor's browser (anywhere) render the identical string
// — no hydration mismatch, and the times shown are always the cinema's own.

import { type Lang, TIME_ZONE } from "./i18n";

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(lang: Lang, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${lang}:${JSON.stringify(opts)}`;
  let found = cache.get(key);
  if (!found) {
    found = new Intl.DateTimeFormat(lang, { timeZone: TIME_ZONE, ...opts });
    cache.set(key, found);
  }
  return found;
}

// `en-CA` renders `YYYY-MM-DD`, which is exactly the calendar-day key we want —
// and computing it through Intl means the day boundary is Lisbon's, not UTC's.
const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `YYYY-MM-DD` in Lisbon — the key screenings are grouped by. */
export function dayKey(ms: number): string {
  return DAY_KEY.format(new Date(ms));
}

/** 24-hour clock: a programme prints `21:00`, never `9:00 PM`. */
export function time(ms: number, lang: Lang): string {
  return formatter(lang, { hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(ms),
  );
}

export function weekday(ms: number, lang: Lang): string {
  return formatter(lang, { weekday: "long" }).format(new Date(ms));
}

export function dayNumber(ms: number, lang: Lang): string {
  return formatter(lang, { day: "numeric" }).format(new Date(ms));
}

export function monthShort(ms: number, lang: Lang): string {
  return formatter(lang, { month: "short" }).format(new Date(ms));
}

export function dateLong(ms: number, lang: Lang): string {
  return formatter(lang, { day: "numeric", month: "long", year: "numeric" }).format(new Date(ms));
}

export function dateMedium(ms: number, lang: Lang): string {
  return formatter(lang, { day: "numeric", month: "short", year: "numeric" }).format(new Date(ms));
}

/** Minutes → `1h 42m`, the way a runtime is printed on a listing. */
export function runtime(minutes: number | undefined): string | null {
  if (typeof minutes !== "number" || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** Decimal degrees, printed the way a map pin reads. */
export function coordinates(point: { lat: number; lng: number }): string {
  const ns = point.lat >= 0 ? "N" : "S";
  const ew = point.lng >= 0 ? "E" : "W";
  return `${Math.abs(point.lat).toFixed(4)}° ${ns}, ${Math.abs(point.lng).toFixed(4)}° ${ew}`;
}

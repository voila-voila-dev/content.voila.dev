/**
 * Deterministic, locale/timezone-stable value formatters shared by the list
 * and detail renderers.
 *
 * Now that the read views server-render their data, formatting must produce
 * byte-identical output on the server (SSR worker) and in the browser, or React
 * throws a hydration mismatch. Two things make `toLocaleString()` unsafe here:
 *
 *   1. Timezone — no-arg `toLocaleString` uses the runtime's local zone, which
 *      differs between the SSR worker and the user's browser.
 *   2. ICU/CLDR version — even pinned to `en-US` + UTC, `Intl.DateTimeFormat`
 *      emits "May 23, 2026, 2:10 PM" on some ICU versions and "…2026 at 2:10 PM"
 *      on others, so an old/new browser can disagree with the worker.
 *
 * So dates are formatted manually from UTC components — no `Intl` for dates.
 * (Localized, timezone-aware display is an i18n concern — see M4.) Numbers keep
 * `Intl.NumberFormat("en-US")`, whose grouping is stable across ICU versions.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const NUMBER = new Intl.NumberFormat("en-US");

function toDate(value: unknown): Date | null {
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `2026-05-23T23:30:00Z` → "May 23, 2026" (UTC calendar day). */
export function formatDate(value: unknown): string {
  const d = toDate(value);
  if (!d) return String(value);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** `2026-05-23T14:10:47Z` → "May 23, 2026, 2:10 PM UTC". */
export function formatDateTime(value: unknown): string {
  const d = toDate(value);
  if (!d) return String(value);
  const meridiem = d.getUTCHours() < 12 ? "AM" : "PM";
  const hour12 = d.getUTCHours() % 12 || 12;
  const minute = String(d.getUTCMinutes()).padStart(2, "0");
  return `${formatDate(d)}, ${hour12}:${minute} ${meridiem} UTC`;
}

export function formatNumber(value: number): string {
  return NUMBER.format(value);
}

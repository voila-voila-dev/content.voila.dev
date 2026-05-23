/**
 * Base shape every domain error extends. Subtypes narrow `code` to a string
 * literal and add structured fields (collection slug, field name, …) so
 * callers can branch on the exact failure without scraping a human message.
 *
 * Domain modules define their own error interfaces extending this shape and
 * combine them into a domain-level union (e.g. `ApiFailure` in the server
 * layer). Carrying those unions through `Result<T, DomainFailure>` is what
 * lets the compiler verify every failure flow end-to-end.
 */
export interface BaseError {
  readonly code: string;
}

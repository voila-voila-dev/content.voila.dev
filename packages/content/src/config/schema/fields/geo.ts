// @voila/content — a geographic point field. One field per file (project
// convention). The value is `{ lat, lng }` in decimal degrees, stored as JSON;
// the admin map view plots markers from it. Non-sortable and non-searchable,
// like the other structured (JSON-backed) kinds.

import { num, struct } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

/** A geographic point: latitude + longitude in decimal degrees. */
export interface GeoValue {
  readonly lat: number;
  readonly lng: number;
}

export type GeoMeta = FieldMeta;
export type GeoOpts = BaseFieldOpts<GeoValue>;

export function geo<const O extends GeoOpts = GeoOpts>(
  opts?: O,
): WithLocalized<GeoValue, O, GeoMeta> {
  const meta: GeoMeta = { kind: "geo", widget: "geo" };
  return applyCommon(struct({ lat: num(), lng: num() }), opts, meta);
}

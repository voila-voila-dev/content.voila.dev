import { num, optional, record, str, struct } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type MediaFit = "cover" | "contain" | "fill" | "inside" | "outside";
export type MediaFormat = "webp" | "avif" | "jpeg" | "png";

export interface MediaTransform {
  readonly width?: number;
  readonly height?: number;
  readonly fit?: MediaFit;
  readonly quality?: number;
  readonly format?: MediaFormat;
}

export type MediaMeta = FieldMeta<{
  readonly accept?: ReadonlyArray<string>;
  readonly max?: number;
  readonly transforms?: Readonly<Record<string, MediaTransform>>;
}>;

export interface MediaOpts extends BaseFieldOpts<MediaValue> {
  /** MIME globs the uploader accepts, e.g. `["image/*"]`. */
  readonly accept?: ReadonlyArray<string>;
  /** Max file size in bytes. */
  readonly max?: number;
  /** Named transforms generated on upload. */
  readonly transforms?: Readonly<Record<string, MediaTransform>>;
}

export interface MediaValue {
  readonly id: string;
  readonly url: string;
  readonly mime: string;
  readonly size: number;
  readonly width?: number;
  readonly height?: number;
  readonly alt?: string;
  readonly variants?: Readonly<Record<string, string>>;
}

const MediaValueSchema = struct({
  id: str(),
  url: str(),
  mime: str(),
  size: num(),
  width: optional(num()),
  height: optional(num()),
  alt: optional(str()),
  variants: optional(record(str())),
});

// A media field is always a single file. Compose `array(media())` for galleries.
export function media<const O extends MediaOpts = MediaOpts>(
  opts?: O,
): WithLocalized<MediaValue, O, MediaMeta> {
  const meta: MediaMeta = {
    kind: "media",
    widget: "media",
    accept: opts?.accept,
    max: opts?.max,
    transforms: opts?.transforms,
  };
  return applyCommon(MediaValueSchema, opts, meta);
}

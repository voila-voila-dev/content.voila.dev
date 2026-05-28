import { Schema } from "effect";
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

export interface MediaOpts extends BaseFieldOpts<MediaValue | ReadonlyArray<MediaValue>> {
  /** MIME globs the uploader accepts, e.g. `["image/*"]`. */
  readonly accept?: ReadonlyArray<string>;
  /** Max file size in bytes. */
  readonly max?: number;
  readonly multiple?: boolean;
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

const MediaValueSchema = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
  mime: Schema.String,
  size: Schema.Number,
  width: Schema.optional(Schema.Number),
  height: Schema.optional(Schema.Number),
  alt: Schema.optional(Schema.String),
  variants: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
});

export const media = <const O extends MediaOpts = MediaOpts>(
  opts?: O,
): WithLocalized<MediaValue | ReadonlyArray<MediaValue>, O> => {
  const o = opts ?? ({} as O);
  const inner: Schema.Schema.Any = o.multiple ? Schema.Array(MediaValueSchema) : MediaValueSchema;
  return applyCommon(inner, o, {
    kind: "media",
    widget: "media",
    accept: o.accept,
    max: o.max,
    multiple: o.multiple ?? false,
    transforms: o.transforms,
  }) as WithLocalized<MediaValue | ReadonlyArray<MediaValue>, O>;
};

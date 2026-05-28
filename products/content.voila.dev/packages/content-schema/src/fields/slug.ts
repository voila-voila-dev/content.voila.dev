// `slug` field — URL-safe identifier matching /^[a-z0-9-]+$/.

import { Schema } from "effect";
import type { SlugFieldMeta } from "../annotation.ts";
import { VoilaField } from "../annotation.ts";

export interface SlugFieldOpts {
  readonly unique?: boolean;
  readonly derivedFrom?: string;
  readonly required?: boolean;
  readonly label?: string;
  readonly description?: string;
}

export const SLUG_PATTERN: RegExp = /^[a-z0-9-]+$/;

export const slug = (opts: SlugFieldOpts = {}): Schema.Schema<string, string, never> => {
  const schema = Schema.String.pipe(
    Schema.pattern(SLUG_PATTERN, {
      identifier: "VoilaSlug",
      message: () => "Expected a slug (lowercase letters, digits, hyphens)",
    }),
  );
  const meta: SlugFieldMeta = {
    kind: "slug",
    widget: "slug",
    required: opts.required,
    label: opts.label,
    description: opts.description,
    unique: opts.unique,
    derivedFrom: opts.derivedFrom,
  };
  return schema.pipe(Schema.annotations({ [VoilaField]: meta }));
};

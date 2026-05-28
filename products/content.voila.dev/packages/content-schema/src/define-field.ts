// defineField — register a third-party field kind without touching engine source.
//
// The factory is expected to produce an annotated Schema (it must call
// `Schema.annotations({ [VoilaField]: { kind, widget, ... } })` itself). For
// convenience and to keep meta consistent we *also* layer an outer annotation
// that asserts the kind, so the value returned by `defineField` is always
// guaranteed to carry a `VoilaField` meta with the registered `kind`.

import { Schema } from "effect";
import type { BaseFieldMeta } from "./annotation.ts";
import { VoilaField } from "./annotation.ts";
import { getFieldMeta } from "./get-field-meta.ts";

export type FieldFactory<Opts, A, I = A> = (opts: Opts) => Schema.Schema<A, I, never>;

/**
 * Register a custom field kind. The returned constructor behaves exactly like
 * the built-ins: it returns an annotated `effect/Schema` and `getFieldMeta`
 * resolves the meta back from it.
 */
export const defineField = <Opts, A, I = A>(
  kind: string,
  factory: FieldFactory<Opts, A, I>,
): FieldFactory<Opts, A, I> => {
  return (opts: Opts) => {
    const built = factory(opts);
    const existing = getFieldMeta<BaseFieldMeta>(built);
    if (existing && existing.kind === kind) {
      // Factory already attached a matching meta — return as-is.
      return built;
    }
    // Either no meta or mismatched kind — wrap with a normalised meta so the
    // contract holds. We preserve any existing meta fields under the new kind.
    const meta: BaseFieldMeta = {
      ...(existing ?? {}),
      kind,
      widget: existing?.widget ?? kind,
    };
    return built.pipe(Schema.annotations({ [VoilaField]: meta }));
  };
};

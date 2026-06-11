// Evaluate a fields map's per-field access rules for one caller. Client-safe
// (pure config, no server imports) so an admin UI can drive the `fields`/
// `columns` props of the content-ui blocks from the same rules the REST layer
// enforces — fields the principal can't read disappear, fields they can't
// write are left out of forms.

import type { FieldAccessContext } from "./_annotation";
import type { Field } from "./_base";
import type { FieldsMap } from "./_map";

export interface AccessibleFields {
  /** Field names whose `access.read` allows (or doesn't exist), in declaration order. */
  readonly readable: ReadonlyArray<string>;
  /** Field names whose `access.write` allows (or doesn't exist), in declaration order. */
  readonly writable: ReadonlyArray<string>;
}

/** A field is readable unless its `access.read` predicate explicitly denies. */
export function canReadField(field: Field, ctx: FieldAccessContext): boolean {
  return field.meta.access?.read?.(ctx) !== false;
}

/** A field is writable unless its `access.write` predicate explicitly denies. */
export function canWriteField(field: Field, ctx: FieldAccessContext): boolean {
  return field.meta.access?.write?.(ctx) !== false;
}

/** Partition a fields map into the names this caller may read and may write. */
export function accessibleFields(fields: FieldsMap, ctx: FieldAccessContext): AccessibleFields {
  const readable: string[] = [];
  const writable: string[] = [];
  for (const [name, field] of Object.entries(fields)) {
    if (canReadField(field, ctx)) readable.push(name);
    if (canWriteField(field, ctx)) writable.push(name);
  }
  return { readable, writable };
}

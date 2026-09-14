// Helpers shared by the structured field constructors (`array`, `object`,
// `blocks`): recognising a nested `Field`, validating a field map with the
// same blank/required semantics the top-level write path applies, and walking
// a field tree (the DDL deriver uses it to find media fields nested anywhere).

import {
  fail,
  type InferShape,
  type Issue,
  issue,
  ok,
  type Shape,
  underPath,
  type Validator,
  validateSync,
  validator,
} from "../std";
import type { Field } from "./_base";
import type { FieldsMap } from "./_map";

/** A voila `Field` (a validator carrying `meta.kind`), as opposed to a bare validator. */
export function isField(v: Validator<unknown>): v is Field {
  const meta = (v as { meta?: unknown }).meta;
  return (
    typeof meta === "object" && meta !== null && typeof (meta as Field["meta"]).kind === "string"
  );
}

/**
 * Nested fields can't be localized on their own — the locale record lives on
 * the OUTER field (localize the array / object / blocks field itself). Every
 * downstream layer that resolves locales (`defineConfig`, `localizeDocument`,
 * search, CSV export) walks top-level fields only, so a nested localized field
 * would silently never be narrowed or resolved.
 */
export function assertNotLocalized(fields: Shape, where: string): void {
  for (const [key, member] of Object.entries(fields)) {
    if (isField(member) && member.meta.localized === true) {
      throw new Error(
        `${where}: nested field "${key}" cannot be localized — set localized: true on the outer field instead.`,
      );
    }
  }
}

/** Absent for write purposes: an unset key or an empty string. */
function unset(v: unknown): boolean {
  return v === undefined || v === null || v === "";
}

/**
 * `struct` over a field map with top-level write semantics: a blank member
 * (`undefined` / `null` / `""`) is omitted unless its field is `required`
 * ("Required." under the member's key); a present member is checked against
 * its own validator, issues nested under its key. Members that are bare
 * validators (not `Field`s) keep plain `struct` semantics — they always run.
 * `extra` adds members validated unconditionally (the block discriminator).
 * Unknown keys are dropped, like `struct`.
 */
export function fieldsStruct<S extends Shape>(
  shape: S,
  extra?: Readonly<Record<string, Validator<unknown>>>,
): Validator<InferShape<S>> {
  const members: ReadonlyArray<[string, Validator<unknown>, boolean]> = [
    ...Object.entries(extra ?? {}).map(([k, v]): [string, Validator<unknown>, boolean] => [
      k,
      v,
      false,
    ]),
    ...Object.entries(shape).map(([k, v]): [string, Validator<unknown>, boolean] => [
      k,
      v,
      isField(v),
    ]),
  ];
  return validator((v) => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) return fail("Expected an object");
    const rec = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const issues: Issue[] = [];
    for (const [key, member, field] of members) {
      const raw = rec[key];
      if (field && unset(raw)) {
        if ((member as Field).meta.required === true) {
          issues.push(...underPath([issue("Required.")], key));
        }
        continue;
      }
      const r = validateSync(member, raw);
      if (r.issues) issues.push(...underPath(r.issues, key));
      else out[key] = r.value;
    }
    return issues.length ? { issues } : ok(out as InferShape<S>);
  });
}

/** `heroBanner` / `hero_banner` / `hero-banner` → `Hero Banner`. */
export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** The nested-field metadata the structured kinds expose. */
interface NestedMeta {
  readonly item?: Field;
  readonly shape?: Shape;
  readonly types?: Readonly<Record<string, { readonly fields: FieldsMap }>>;
}

/**
 * Depth-first walk over a field map and every field reachable through a
 * structured field's meta: `array` → `meta.item`, `object` → `meta.shape`,
 * `blocks` → `meta.types[*].fields`. `path` names the route to the field
 * (`["blocks", "hero", "image"]`).
 */
export function walkFields(
  fields: Shape,
  visit: (field: Field, path: ReadonlyArray<string>) => void,
  path: ReadonlyArray<string> = [],
): void {
  for (const [key, member] of Object.entries(fields)) {
    if (!isField(member)) continue;
    const here = [...path, key];
    visit(member, here);
    const meta = member.meta as NestedMeta;
    if (meta.item) walkFields({ item: meta.item }, visit, here);
    if (meta.shape) walkFields(meta.shape, visit, here);
    if (meta.types) {
      for (const [type, def] of Object.entries(meta.types)) {
        walkFields(def.fields, visit, [...here, type]);
      }
    }
  }
}

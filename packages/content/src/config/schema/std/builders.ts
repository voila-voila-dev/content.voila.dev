// Validator builders + refinement checks. These are the pure-TS replacements
// for the handful of `effect/Schema` constructors the field layer used:
// `str`/`num`/`bool` for primitives, `literal`/`union` for enums and tagged
// shapes, `arrayOf`/`struct`/`record` for structured values, `lazy` for the
// recursive rich-text node graph, and `Check`s (`minLength`, `min`, …) fed to
// `refine`.

import {
  type Check,
  fail,
  type Infer,
  type Issue,
  issue,
  ok,
  type Result,
  underPath,
  type Validator,
  validateSync,
  validator,
} from "./core";

// The escape hatch: accept any value and trust the caller's `T` (defaults to
// `unknown`). The lone `as` here is the whole point of the builder.
export function unknown<T = unknown>(): Validator<T> {
  return validator<T>((v) => ok(v as T));
}

export function str(): Validator<string> {
  return validator((v) => (typeof v === "string" ? ok(v) : fail("Expected a string")));
}

export function num(): Validator<number> {
  return validator((v) =>
    typeof v === "number" && Number.isFinite(v) ? ok(v) : fail("Expected a number"),
  );
}

export function bool(): Validator<boolean> {
  return validator((v) => (typeof v === "boolean" ? ok(v) : fail("Expected a boolean")));
}

export function literal<const L extends string | number | boolean>(
  ...allowed: readonly L[]
): Validator<L> {
  return validator((v) =>
    allowed.includes(v as L) ? ok(v as L) : fail(`Expected one of: ${allowed.join(", ")}`),
  );
}

declare const OptionalBrand: unique symbol;

/**
 * A validator that also accepts `undefined`. The brand lets `struct` turn it
 * into an optional *key* (`k?: T`) rather than a required `k: T | undefined`.
 */
export type OptionalValidator<T> = Validator<T | undefined> & {
  readonly [OptionalBrand]: true;
};

export function optional<T>(inner: Validator<T>): OptionalValidator<T> {
  return validator((v) =>
    v === undefined ? ok(undefined) : validateSync(inner, v),
  ) as OptionalValidator<T>;
}

export function arrayOf<T>(inner: Validator<T>): Validator<ReadonlyArray<T>> {
  return validator((v) => {
    if (!Array.isArray(v)) return fail("Expected an array");
    const out: T[] = [];
    const issues: Issue[] = [];
    v.forEach((el, i) => {
      const r = validateSync(inner, el);
      if (r.issues) issues.push(...underPath(r.issues, i));
      else out.push(r.value);
    });
    return issues.length ? { issues } : ok(out);
  });
}

type AnyValidator = Validator<unknown>;

export function union<Members extends ReadonlyArray<AnyValidator>>(
  ...members: Members
): Validator<Infer<Members[number]>> {
  type Out = Infer<Members[number]>;
  return validator<Out>((v) => {
    for (const member of members) {
      const r = validateSync(member, v);
      if (!r.issues) return r as Result<Out>;
    }
    return fail("No matching variant");
  });
}

export type Shape = Readonly<Record<string, AnyValidator>>;

/**
 * The decoded object type for a `struct` shape: `optional(x)` keys become
 * optional properties (`k?: T`); everything else is a required property
 * carrying the validator's exact output type. Exported so field constructors
 * (e.g. `object`) can declare their value type from the shape with no cast.
 */
export type InferShape<S extends Shape> = {
  readonly [K in keyof S as S[K] extends OptionalValidator<unknown> ? never : K]: Infer<S[K]>;
} & {
  readonly [K in keyof S as S[K] extends OptionalValidator<unknown> ? K : never]?: Exclude<
    Infer<S[K]>,
    undefined
  >;
};

export function struct<S extends Shape>(shape: S): Validator<InferShape<S>> {
  return validator((v) => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) return fail("Expected an object");
    const rec = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const issues: Issue[] = [];
    for (const key of Object.keys(shape)) {
      const r = validateSync(shape[key] as AnyValidator, rec[key]);
      if (r.issues) issues.push(...underPath(r.issues, key));
      else out[key] = r.value;
    }
    return issues.length ? { issues } : ok(out as InferShape<S>);
  });
}

/**
 * A keyed record. With no `keys`, every own key of the input is validated
 * (the wide localized form). With `keys`, exactly those keys are required —
 * this is how `defineConfig` narrows a localized field to the project locales.
 */
export function record<T>(
  value: Validator<T>,
  keys?: ReadonlyArray<string>,
): Validator<Record<string, T>> {
  return validator((v) => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) return fail("Expected an object");
    const rec = v as Record<string, unknown>;
    const out: Record<string, T> = {};
    const issues: Issue[] = [];
    for (const key of keys ?? Object.keys(rec)) {
      const r = validateSync(value, rec[key]);
      if (r.issues) issues.push(...underPath(r.issues, key));
      else out[key] = r.value;
    }
    return issues.length ? { issues } : ok(out);
  });
}

/** Absent for write purposes: an unset key or an empty string. */
function localeUnset(v: unknown): boolean {
  return v === undefined || v === null || v === "";
}

/**
 * The record behind a localized field. Unlike {@link record}, only the locales
 * in `required` must carry a value — every other locale may be absent or blank
 * and is simply omitted from the decoded record. That is what makes a
 * monolingual editor able to save a `required` localized field: the project's
 * default locale is the only one that has to be filled, and the read path's
 * fallback chain covers the rest.
 *
 * A blank required locale fails under that locale's own path (`title.en-US`),
 * so the message lands on the offending input rather than the whole field.
 */
export function localizedRecord<T>(
  value: Validator<T>,
  locales: ReadonlyArray<string>,
  required: ReadonlyArray<string> = [],
): Validator<Record<string, T>> {
  const requiredSet = new Set(required);
  return validator((v) => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) return fail("Expected an object");
    const rec = v as Record<string, unknown>;
    const out: Record<string, T> = {};
    const issues: Issue[] = [];
    for (const key of locales) {
      if (localeUnset(rec[key])) {
        if (requiredSet.has(key)) issues.push(...underPath([issue("Required.")], key));
        continue;
      }
      const r = validateSync(value, rec[key]);
      if (r.issues) issues.push(...underPath(r.issues, key));
      else out[key] = r.value;
    }
    return issues.length ? { issues } : ok(out);
  });
}

/** Defer resolution of `get` so a validator can reference itself (rich-text nodes). */
export function lazy<T>(get: () => Validator<T>): Validator<T> {
  return validator((v) => validateSync(get(), v));
}

// ── Refinement checks (fed to `refine`) ─────────────────────────────────────
export function minLength(n: number): Check<string> {
  return (s) => (s.length < n ? `Must be at least ${n} character${n === 1 ? "" : "s"}` : undefined);
}
export function maxLength(n: number): Check<string> {
  return (s) => (s.length > n ? `Must be at most ${n} character${n === 1 ? "" : "s"}` : undefined);
}
export function pattern(re: RegExp): Check<string> {
  return (s) => (re.test(s) ? undefined : "Does not match the expected format");
}
export function min(n: number): Check<number> {
  return (x) => (x < n ? `Must be ≥ ${n}` : undefined);
}
export function max(n: number): Check<number> {
  return (x) => (x > n ? `Must be ≤ ${n}` : undefined);
}
export function integer(): Check<number> {
  return (x) => (Number.isInteger(x) ? undefined : "Must be an integer");
}
export function minItems(n: number): Check<ReadonlyArray<unknown>> {
  return (a) => (a.length < n ? `Must have at least ${n} item${n === 1 ? "" : "s"}` : undefined);
}
export function maxItems(n: number): Check<ReadonlyArray<unknown>> {
  return (a) => (a.length > n ? `Must have at most ${n} item${n === 1 ? "" : "s"}` : undefined);
}

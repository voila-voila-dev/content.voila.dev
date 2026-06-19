// The pure-TypeScript validator core. Every voila field is a Standard Schema
// (`StandardSchemaV1`) so it interops with anything that speaks the spec —
// React Hook Form, TanStack Form, the eventual write path, etc. — without
// dragging a validation library into the package. A `Validator<T>` is just an
// object with a synchronous `~standard.validate`; the builders in `./builders`
// compose them and `refine` layers extra checks on top.

import type { StandardSchemaV1 } from "@standard-schema/spec";

export type Validator<T> = StandardSchemaV1<unknown, T>;
export type Result<T> = StandardSchemaV1.Result<T>;
export type Issue = StandardSchemaV1.Issue;

/** Extract the validated (output) type carried by a `Validator`. */
export type Infer<V> = V extends Validator<infer T> ? T : never;

const VENDOR = "voila";

/**
 * Build a `Validator` from a synchronous validate function. `types` is the
 * spec's phantom carrier — never populated at runtime, only there so external
 * tooling that reads `StandardSchemaV1.InferOutput` resolves `T`.
 */
export function validator<T>(validate: (value: unknown) => Result<T>): Validator<T> {
  return {
    "~standard": {
      version: 1,
      vendor: VENDOR,
      validate,
      types: undefined as unknown as StandardSchemaV1.Types<unknown, T>,
    },
  };
}

export function ok<T>(value: T): Result<T> {
  return { value };
}

export function issue(message: string, path?: ReadonlyArray<PropertyKey>): Issue {
  return path ? { message, path } : { message };
}

export function fail(message: string, path?: ReadonlyArray<PropertyKey>): Result<never> {
  return { issues: [issue(message, path)] };
}

/** Prepend a segment onto each issue's path — used when descending into arrays/objects. */
export function underPath(issues: ReadonlyArray<Issue>, segment: PropertyKey): Issue[] {
  return issues.map((i) => ({ message: i.message, path: [segment, ...(i.path ?? [])] }));
}

/**
 * Run a schema synchronously. Voila schemas never return a Promise; if one
 * somehow does, that's a programming error rather than an async schema.
 */
export function validateSync<T>(schema: Validator<T>, value: unknown): Result<T> {
  const r = schema["~standard"].validate(value);
  if (r instanceof Promise) throw new TypeError("voila schemas validate synchronously");
  return r;
}

/** Thrown by `decodeSync` when validation fails; carries the raw `issues`. */
export class SchemaError extends Error {
  readonly issues: ReadonlyArray<Issue>;
  constructor(issues: ReadonlyArray<Issue>) {
    super(
      issues
        .map((i) => (i.path?.length ? `${i.path.join(".")}: ${i.message}` : i.message))
        .join("; "),
    );
    this.name = "SchemaError";
    this.issues = issues;
  }
}

/** Validate and return the decoded value, throwing a `SchemaError` on failure. */
export function decodeSync<T>(schema: Validator<T>, value: unknown): T {
  const r = validateSync(schema, value);
  if (r.issues) throw new SchemaError(r.issues);
  return r.value;
}

/** A refinement: returns an error message when `value` is invalid, else undefined. */
export type Check<T> = (value: T) => string | undefined;

/**
 * Layer extra `checks` on top of a base validator. The base decodes first;
 * checks only run on the decoded value, and all failing checks are reported.
 */
export function refine<T>(base: Validator<T>, ...checks: ReadonlyArray<Check<T>>): Validator<T> {
  return validator((input) => {
    const r = validateSync(base, input);
    if (r.issues) return r;
    const issues: Issue[] = [];
    for (const check of checks) {
      const message = check(r.value);
      if (message) issues.push(issue(message));
    }
    return issues.length ? { issues } : r;
  });
}

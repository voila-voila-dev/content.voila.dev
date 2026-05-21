import type { FieldDef } from "../types.ts";

export type JsonField<T> = FieldDef<T> & {
  kind: "json";
};

export type JsonFieldOptions<T> = Omit<JsonField<T>, "kind">;

export function json<T = unknown>(options: JsonFieldOptions<T> = {}): JsonField<T> {
  return { ...options, kind: "json" };
}

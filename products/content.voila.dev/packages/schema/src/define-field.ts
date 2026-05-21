import type { FieldDef } from "./types.ts";

type Builder<Options, Value, Extras> = (options: Options) => Omit<FieldDef<Value>, "kind"> & Extras;

export function defineField<
  Kind extends string,
  Options extends object = object,
  Value = unknown,
  Extras extends object = object,
>(
  kind: Kind,
  build: Builder<Options, Value, Extras>,
): (options?: Options) => FieldDef<Value> & { kind: Kind } & Extras {
  return (options) => {
    const opts = (options ?? {}) as Options;
    return { ...build(opts), kind };
  };
}

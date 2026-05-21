export type FieldContext = {
  user?: unknown;
  doc?: unknown;
};

export type FieldAccess = {
  read?: (ctx: FieldContext, doc?: unknown) => boolean;
  write?: (ctx: FieldContext, doc?: unknown) => boolean;
};

export type FieldTransform<T> = {
  input?: (value: unknown, ctx: FieldContext) => T;
  output?: (value: T, ctx: FieldContext) => unknown;
};

export type FieldValidate<T> = (
  value: T,
  ctx: FieldContext,
) => string | true | Promise<string | true>;

export type FieldFilter = "text" | "select" | "range" | "date" | false;
export type FieldHidden = boolean | "list" | "detail";

export type FieldDef<T = unknown> = {
  kind: string;
  required?: boolean;
  default?: T | (() => T);
  unique?: boolean;
  index?: boolean;
  searchable?: boolean | { weight?: number };
  localized?: boolean;
  hidden?: FieldHidden;
  readOnly?: boolean | ((ctx: FieldContext) => boolean);
  access?: FieldAccess;
  validate?: FieldValidate<T>;
  transform?: FieldTransform<T>;
  filter?: FieldFilter;
  label?: string;
  description?: string;
  group?: string;
};

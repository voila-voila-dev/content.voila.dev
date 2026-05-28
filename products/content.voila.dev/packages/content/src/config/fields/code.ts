import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type CodeLanguage =
  | "ts"
  | "js"
  | "tsx"
  | "jsx"
  | "json"
  | "html"
  | "css"
  | "sql"
  | "shell"
  | "yaml"
  | "toml"
  | "md"
  | "plain";

export interface CodeOpts extends BaseFieldOpts<string> {
  readonly language?: CodeLanguage;
}

export const code = <const O extends CodeOpts = CodeOpts>(opts?: O): WithLocalized<string, O> => {
  const o = opts ?? ({} as O);
  return applyCommon(Schema.String, o, {
    kind: "code",
    widget: "code",
    language: o.language ?? "plain",
  }) as WithLocalized<string, O>;
};

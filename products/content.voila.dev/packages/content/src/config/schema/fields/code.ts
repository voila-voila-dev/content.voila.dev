import { str } from "../std";
import type { FieldMeta } from "./_annotation";
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

export type CodeMeta = FieldMeta<{ readonly language?: CodeLanguage }>;

export interface CodeOpts extends BaseFieldOpts<string> {
  readonly language?: CodeLanguage;
}

export function code<const O extends CodeOpts = CodeOpts>(
  opts?: O,
): WithLocalized<string, O, CodeMeta> {
  const meta: CodeMeta = { kind: "code", widget: "code", language: opts?.language ?? "plain" };
  return applyCommon(str(), opts, meta);
}

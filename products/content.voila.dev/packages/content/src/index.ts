export { fields } from "@voila/content-schema";
export {
  builtinWidgets,
  createWidgetRegistry,
  defaultWidgetRegistry,
  defineWidget,
  resolveWidget,
  type WidgetComponent,
  type WidgetDef,
  type WidgetProps,
  type WidgetRegistry,
} from "./admin/widgets/index.ts";
export { defineCollection, defineContent, defineSingleton } from "./define.ts";
export type {
  AnyCollection,
  AnyContent,
  AnySingleton,
  AuthConfigShape,
  Branding,
  Collection,
  CollectionDef,
  Content,
  ContentConfig,
  FieldsRecord,
  ListConfig,
  Mount,
  ResolvedContentConfig,
  ResolvedMount,
  Singleton,
  SingletonDef,
} from "./types.ts";

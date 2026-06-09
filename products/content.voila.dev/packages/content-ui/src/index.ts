// @voila/content-ui — schema-aware blocks that read a `@voila/content` config
// and compose `@voila/ui` primitives. Phase 3: the widget registries,
// `FieldRenderer`, `DataTable` (read/display), and `CollectionForm` (write).
// AdminShell and views follow in later slices.

export { CollectionForm, type CollectionFormProps } from "./collection-form";
export { DataTable, type DataTableProps } from "./data-table";
export { FieldRenderer, type FieldRendererProps } from "./field-renderer";
export { humanize } from "./lib/humanize";
export { type FormValidation, validateFields } from "./lib/validate";
export {
  defaultEditRegistry,
  type EditRegistry,
  mergeEditRegistry,
  resolveEditWidget,
} from "./registry/edit";
export {
  type DisplayRegistry,
  defaultDisplayRegistry,
  mergeDisplayRegistry,
  resolveDisplayWidget,
} from "./registry/registry";
export {
  BooleanDisplay,
  DateDisplay,
  type DisplayWidget,
  type DisplayWidgetProps,
  JsonDisplay,
  NumberDisplay,
  TextDisplay,
} from "./widgets/display";
export {
  BooleanInput,
  DateInput,
  type EditWidget,
  type EditWidgetProps,
  NumberInput,
  SelectInput,
  selectOptions,
  TextareaInput,
  TextInput,
  UnsupportedInput,
} from "./widgets/edit";

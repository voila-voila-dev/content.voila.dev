// @voila/content-ui — schema-aware blocks that read a `@voila/content` config
// and compose `@voila/ui` primitives. Phase 3 read/display slice: the widget
// registry, `FieldRenderer`, and `DataTable`. Forms, AdminShell, and views
// follow in later slices.

export { DataTable, type DataTableProps } from "./data-table";
export { FieldRenderer, type FieldRendererProps } from "./field-renderer";
export { humanize } from "./lib/humanize";
export {
  type DisplayRegistry,
  defaultDisplayRegistry,
  mergeRegistry,
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

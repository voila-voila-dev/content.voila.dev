// @voila/content-ui — schema-aware blocks that read a `@voila/content` config
// and compose `@voila/ui` primitives. Phase 3: the widget registries,
// `FieldRenderer`, `DataTable` (read/display), `CollectionForm` (write), the
// `AdminShell` + `AppSidebar` layout (nav from config), and the `ListView` /
// `DetailView` pages that wrap them for a collection's list and detail screens.

export { AdminShell, type AdminShellProps } from "./admin-shell";
export { AppSidebar, type AppSidebarProps } from "./app-sidebar";
export { CollectionForm, type CollectionFormProps } from "./collection-form";
export { DataTable, type DataTableProps } from "./data-table";
export { DetailView, type DetailViewProps } from "./detail-view";
export { FieldRenderer, type FieldRendererProps } from "./field-renderer";
export { humanize } from "./lib/humanize";
export {
  type BuildNavOptions,
  buildNav,
  type NavGroups,
  type NavItem,
} from "./lib/nav";
export { type FormValidation, validateFields } from "./lib/validate";
export { ListView, type ListViewProps } from "./list-view";
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

// @voila/content-ui — schema-aware blocks that read a `@voila/content` config
// and compose `@voila/ui` primitives. Phase 3: the widget registries,
// `FieldRenderer`, `DataTable` (read/display), `CollectionForm` (write), the
// `AdminShell` + `AppSidebar` layout (nav from config), the `ListView` /
// `DetailView` pages, and the `Dashboard` + `StatCard` landing widgets.

export { AdminShell, type AdminShellProps } from "./admin-shell";
export { AppSidebar, type AppSidebarProps } from "./app-sidebar";
export { CollectionForm, type CollectionFormProps } from "./collection-form";
export { Dashboard, type DashboardProps } from "./dashboard";
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
export { type PublishState, publishStatus } from "./lib/publish-status";
export { type FormValidation, validateFields } from "./lib/validate";
export { ListView, type ListViewProps } from "./list-view";
export { PublishControls, type PublishControlsProps } from "./publish-controls";
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
  RevisionHistory,
  type RevisionHistoryItem,
  type RevisionHistoryProps,
} from "./revision-history";
export { StatusFilter, type StatusFilterProps, type StatusFilterValue } from "./status-filter";
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
export { StatCard, type StatCardProps } from "./widgets/stat-card";
export { StatusBadge, type StatusBadgeProps } from "./widgets/status-badge";

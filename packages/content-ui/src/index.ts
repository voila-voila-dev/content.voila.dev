// @voila/content-ui — schema-aware blocks that read a `@voila/content` config
// and compose `@voila/ui` primitives. Phase 3: the widget registries,
// `FieldRenderer`, `DataTable` (read/display), `CollectionForm` (write), the
// `AdminShell` + `AppSidebar` layout (nav from config), the `ListView` /
// `DetailView` pages, and the `Dashboard` + `StatCard` landing widgets.

export { AdminShell, type AdminShellProps } from "./admin-shell";
export { AppSidebar, type AppSidebarProps } from "./app-sidebar";
export { CollectionForm, type CollectionFormProps, type FormValues } from "./collection-form";
export { ConfirmButton, type ConfirmButtonProps } from "./confirm-button";
export { Dashboard, type DashboardProps } from "./dashboard";
export { DataTable, type DataTableProps } from "./data-table";
export { DetailView, type DetailViewProps, documentTitle } from "./detail-view";
export { FieldRenderer, type FieldRendererProps } from "./field-renderer";
export type { Doc } from "./lib/doc";
export { getFieldLabel, humanize } from "./lib/humanize";
export {
  type BuildNavOptions,
  buildNav,
  type NavGroups,
  type NavItem,
} from "./lib/nav";
export { type PublishState, publishStatus } from "./lib/publish-status";
export {
  applyTheme,
  resolvedTheme,
  setTheme,
  storedTheme,
  systemTheme,
  THEME_STORAGE_KEY,
  type Theme,
  themeInitScript,
} from "./lib/theme";
export { type FormValidation, validateFields } from "./lib/validate";
export { ListView, type ListViewProps } from "./list-view";
export { LocalizedFieldEditor, type LocalizedFieldEditorProps } from "./localized-field";
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
export { resolveWidget } from "./registry/resolve";
export {
  RevisionHistory,
  type RevisionHistoryItem,
  type RevisionHistoryProps,
} from "./revision-history";
export { SearchInput, type SearchInputProps } from "./search-input";
export { StatusFilter, type StatusFilterProps, type StatusFilterValue } from "./status-filter";
export { ThemeToggle } from "./theme-toggle";
export {
  BooleanDisplay,
  ColorDisplay,
  DateDisplay,
  type DisplayWidget,
  type DisplayWidgetProps,
  Empty,
  JsonDisplay,
  MultilineTextDisplay,
  NumberDisplay,
  RichTextValueDisplay,
  TextDisplay,
} from "./widgets/display";
export {
  BooleanInput,
  ColorInput,
  DateInput,
  type EditWidget,
  type EditWidgetProps,
  MonospaceTextareaInput,
  NumberInput,
  SelectInput,
  selectOptions,
  TextareaInput,
  TextInput,
  UnsupportedInput,
} from "./widgets/edit";
export {
  type CreateMediaInputOptions,
  createMediaInput,
  MediaDisplay,
  type MediaUploader,
} from "./widgets/media";
export { StatCard, type StatCardProps } from "./widgets/stat-card";
export { StatusBadge, type StatusBadgeProps } from "./widgets/status-badge";

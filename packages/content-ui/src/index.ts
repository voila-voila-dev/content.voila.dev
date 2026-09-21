// @voila/content-ui — schema-aware blocks that read a `@voila/content` config
// and compose `@voila.dev/ui` primitives. Phase 3: the widget registries,
// `FieldRenderer`, `DataTable` (read/display), `CollectionForm` (write), the
// `AdminShell` + `AppSidebar` layout (nav from config), the `ListView` /
// `DetailView` pages, and the `Dashboard` + `StatCard` landing widgets.

export { AdminShell, type AdminShellProps } from "./admin-shell";
export { AppSidebar, type AppSidebarProps } from "./app-sidebar";
export {
  CalendarView,
  type CalendarViewMode,
  type CalendarViewProps,
  readInstant,
  rowsToEvents,
} from "./calendar-view";
export { CollectionForm, type CollectionFormProps, type FormValues } from "./collection-form";
export { ColumnEditor, ColumnPicker, type ColumnPickerProps } from "./column-picker";
export { ConfirmButton, type ConfirmButtonProps } from "./confirm-button";
export { Dashboard, type DashboardProps, type RecentItem } from "./dashboard";
export { DataTable, type DataTableProps, type TableDensity } from "./data-table";
export { DetailView, type DetailViewProps, documentTitle } from "./detail-view";
export { FieldCard } from "./field-card";
export { FieldGroupNav, type FieldGroupNavProps, resolveGroupIcon } from "./field-group-nav";
export { FieldRenderer, type FieldRendererProps } from "./field-renderer";
export { FieldRow, type FieldRowProps } from "./field-row";
export { FilterBuilder, type FilterBuilderProps, FilterEditor } from "./filter-builder";
export { KanbanView, type KanbanViewProps } from "./kanban-view";
export {
  accentColor,
  adjustForTheme,
  contrastForeground,
  formatOklch,
  hexToOklch,
  type Oklch,
  oklchLuminance,
  oklchToHex,
  parseHex,
  parseOklch,
  type ThemeDensity,
  type ThemeRadius,
  type ThemeTokensOptions,
  themeTokensCss,
} from "./lib/accent";
export { defaultCardFields } from "./lib/card-fields";
export type { Doc } from "./lib/doc";
export {
  type DeclaredColumn,
  type GroupByOptions,
  type GroupColumn,
  groupBy,
} from "./lib/group-by";
export {
  formWidthFor,
  type ResolvedGroup,
  type ResolveFieldGroupsOptions,
  resolveFieldGroups,
} from "./lib/groups";
export { getFieldLabel, humanize, singularLabel } from "./lib/humanize";
export {
  type I18nContextValue,
  I18nProvider,
  type I18nProviderProps,
  isLocalizedRecord,
  type ResolvedLocalized,
  resolveLocalized,
  useI18n,
} from "./lib/i18n";
export { type IconComponent, NamedIcon, resolveIcon } from "./lib/icons";
export { DEFAULT_MAP_DARK_STYLE_URL, DEFAULT_MAP_STYLE_URL } from "./lib/map-style";
export {
  type BuildNavOptions,
  buildNav,
  DEFAULT_GROUP_LABELS,
  DEFAULT_NAV_ICONS,
  homeHref,
  isNavActive,
  markLongestActive,
  type NavGroup,
  type NavGroups,
  type NavItem,
  type NavLayoutGroup,
  normalizeBase,
} from "./lib/nav";
export {
  collectionOperations,
  type ResolvedCollectionOperations,
} from "./lib/operations";
export { type PublishState, publishStatus } from "./lib/publish-status";
export {
  ShellContext,
  type ShellContextValue,
  type SidebarSection,
  type SidebarSectionItem,
  useRegisterSidebarSection,
  useShell,
} from "./lib/shell-context";
export { markdownToPlain, richTextToPlain, truncateText } from "./lib/text";
export {
  applyTheme,
  resolvedTheme,
  setTheme,
  setThemeChoice,
  storedTheme,
  systemTheme,
  THEME_STORAGE_KEY,
  type Theme,
  type ThemeChoice,
  themeChoice,
  themeInitScript,
  watchSystemTheme,
} from "./lib/theme";
export {
  type FieldIssue,
  type FormValidation,
  formatFieldIssue,
  issueMessageAt,
  issuesUnder,
  validateFields,
} from "./lib/validate";
export { ListView, type ListViewProps, PAGE_SIZES, searchEnabled } from "./list-view";
export {
  type LocaleProgress,
  LocaleSwitcher,
  type LocaleSwitcherProps,
} from "./locale-switcher";
export { LocalizedFieldEditor, type LocalizedFieldEditorProps } from "./localized-field";
export { MapView, type MapViewProps } from "./map-view";
export {
  layoutFor,
  NestedDisplayRows,
  type NestedDisplayRowsProps,
  NestedFields,
  type NestedFieldsProps,
  type NestedLayout,
  visibleKeys,
} from "./nested-fields";
export { type BodyWidth, PageLayout, pageGutter } from "./page-layout";
export { PublishControls, type PublishControlsProps } from "./publish-controls";
export {
  DisplayRegistryProvider,
  EditRegistryProvider,
  useDisplayRegistry,
  useEditRegistry,
} from "./registry/context";
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
  DEFAULT_SHORTCUTS,
  type ShortcutHint,
  UserMenu,
  type UserMenuProps,
  userInitials,
} from "./user-menu";
export {
  type FieldChoice,
  type ViewFieldChoices,
  type ViewTabItem,
  ViewTabs,
  type ViewTabsProps,
  type ViewType,
} from "./view-tabs";
export { ArrayDisplay, ArrayInput, arrayItems, moveItem, useItemKeys } from "./widgets/array";
export {
  BlocksDisplay,
  BlocksInput,
  type BlockTypeShape,
  blankBlock,
  blockSummary,
  blocksValue,
  blockType,
} from "./widgets/blocks";
export {
  BooleanDisplay,
  ColorDisplay,
  DateDisplay,
  type DisplayContext,
  type DisplayWidget,
  type DisplayWidgetProps,
  Empty,
  EnumDisplay,
  type EnumTone,
  enumTone,
  formatDate,
  isCompact,
  JsonDisplay,
  MultilineTextDisplay,
  NumberDisplay,
  Preview,
  RichTextValueDisplay,
  relativeDate,
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
  type CreateGeoInputOptions,
  createGeoInput,
  GeoDisplay,
  GeoInput,
} from "./widgets/geo";
export {
  type CreateMediaInputOptions,
  createMediaInput,
  formatBytes,
  MediaDisplay,
  type MediaLister,
  type MediaUploader,
  mediaFilename,
  tooLargeMessage,
  uploadErrorMessage,
} from "./widgets/media";
export {
  MultiSelectDisplay,
  MultiSelectInput,
  multiSelectValues,
} from "./widgets/multi-select";
export { ObjectDisplay, ObjectInput } from "./widgets/object";
export {
  createRelationDisplay,
  createRelationInput,
  RelationIdInput,
  type RelationLoader,
  type RelationOption,
  type RelationWidgetOptions,
  relationIds,
  shortId,
} from "./widgets/relation";
export { StatCard, type StatCardProps } from "./widgets/stat-card";
export { StatusBadge, type StatusBadgeProps } from "./widgets/status-badge";

/**
 * Internal subpath consumed only by route files that the `voila()` vite
 * plugin generates inside the consumer's `src/routes/admin/` tree. Not
 * part of the documented public surface — do not import this from user
 * code; the surface is intentionally undocumented and may change in
 * lockstep with the plugin's codegen.
 */

export type { FindResponse, ListParams, ListResponse } from "./admin/api-client.ts";
export { ApiError, fetchById, fetchList, queryKeys } from "./admin/api-client.ts";
export {
  CollectionDetailView,
  detailQueryOptions,
} from "./admin/collection-detail-view.tsx";
export { CollectionForm, type CollectionFormProps } from "./admin/collection-form.tsx";
export {
  CollectionListView,
  listQueryOptions,
} from "./admin/collection-list-view.tsx";
export { EmptyState } from "./admin/empty-state.tsx";
export { formatFieldValue, ReadOnlyField } from "./admin/field-display.tsx";
export { FormCard } from "./admin/form-card.tsx";
export { LoginView } from "./admin/login-view.tsx";
export type { NavigationItem } from "./admin/page-layout.tsx";
export { PageLayout } from "./admin/page-layout.tsx";
export { getCollection, getSingleton } from "./admin/registry.ts";
export { AdminSidebar } from "./admin/sidebar.tsx";
export {
  SingletonView,
  singletonQueryOptions,
} from "./admin/singleton-view.tsx";
export { DetailSkeleton, ListSkeleton } from "./admin/skeletons.tsx";
export {
  BooleanWidget,
  DateWidget,
  FieldWidget,
  type FieldWidgetProps,
  NumberWidget,
  SelectWidget,
  SlugWidget,
  StringWidget,
  slugify,
} from "./admin/widgets/index.ts";
export { AdminDashboard, AdminLayout, AdminShell } from "./admin-shell.tsx";
export type { RouteHead } from "./head.ts";
export { buildAdminHead, buildSetupHead } from "./head.ts";
export { SetupPage } from "./setup-page.tsx";

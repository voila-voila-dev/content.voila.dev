// `@voila/content-admin/screens` — the generic, config-driven admin screens the host's
// fixed route shims re-export. Each reads `AdminProvider` context + route params,
// so one definition serves every collection and adding a collection needs no new
// file.

export { AdminLayoutScreen } from "./admin-layout";
export { CollectionDetailScreen } from "./collection-detail";
export { CollectionListScreen } from "./collection-list";
export { CollectionNewScreen } from "./collection-new";
export { CustomScreenDispatcher } from "./custom-dispatcher";
export { DashboardScreen } from "./dashboard";
export { LoginScreen } from "./login";
export { SingletonScreen } from "./singleton";

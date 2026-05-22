/**
 * Internal subpath consumed only by route files that the `voila()` vite
 * plugin generates inside the consumer's `src/routes/admin/` tree. Not
 * part of the documented public surface — do not import this from user
 * code; the surface is intentionally undocumented and may change in
 * lockstep with the plugin's codegen.
 */
export { AdminShell } from "./admin-shell.tsx";
export type { RouteHead } from "./head.ts";
export { buildAdminHead, buildSetupHead } from "./head.ts";
export { SetupPage } from "./setup-page.tsx";

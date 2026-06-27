// `@voila/content-admin` — a config-driven admin framework on TanStack Start. `defineAdmin`
// builds the typed client + extension config a site provides once; `AdminProvider`
// shares it with the generic screens (`@voila/content-admin/screens`). The server runtime
// lives at `@voila/content-admin/server` (+ `@voila/content-admin/cloudflare`).
// See docs/decision-records/0003-admin-framework-package.md.

export { AdminProvider, type AdminProviderProps, useAdmin } from "./context";
export { defineAdmin } from "./define-admin";
export { type AuthedFetchOptions, makeAuthedFetch } from "./lib/authed-fetch";
export {
  type BrandingHeadOptions,
  brandingHead,
  type HeadLink,
  type HeadMeta,
} from "./lib/branding-head";
export { matchScreen, type ScreenMatch } from "./lib/match";
export { buildExtraGroups, type NavGroup } from "./nav";
export type {
  AdminBranding,
  AdminInstance,
  AdminSlots,
  AdminUser,
  CustomScreen,
  CustomScreenProps,
  DefineAdminOptions,
  NavExtension,
} from "./types";

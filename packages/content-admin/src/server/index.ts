// `@voila/content-admin/server` — the framework's server runtime, free of any React or
// `@voila/ui` dependency. Deployment targets (`@voila/content-admin/cloudflare`,
// `@voila/content-admin/node`) build a driver + storage from their environment and call
// `createAdminRuntime`; the host's `admin.api.$.ts` route delegates to
// `createApiHandler`.

export { createApiHandler } from "./api-handler";
export { countDocuments, resolveSession, type SessionUser } from "./loaders";
export {
  type AdminAuthBridge,
  type AdminRuntime,
  type AdminRuntimeOptions,
  createAdminRuntime,
} from "./runtime";

// Ambient declaration for the Cloudflare `cloudflare:workers` virtual module so
// `@voila/content-admin/cloudflare` typechecks without `@cloudflare/workers-types`
// installed. The real module is provided by the workerd runtime at deploy time;
// we read `env` through it. `WorkerAdminEnv` (in cloudflare.ts) narrows the shape
// we actually use, so the loose `unknown` here never leaks past the cast.
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}

// @voila/content-registry — the catalog of vendable admin source (`voila add`).
// A shadcn-style registry: items declare the real files they own plus their npm
// and registry dependencies; the resolver turns a set of item names into an
// ordered install plan, and `files` reads the source off disk to be copied into
// a consumer app, where it becomes the app's own code.

export { ITEMS_DIR, itemSourcePath, readItemFile } from "./files";
export { registry } from "./registry";
export { getItem, listItems, RegistryError, type ResolvedPlan, resolve } from "./resolve";
export {
  fileTarget,
  type Registry,
  type RegistryFile,
  type RegistryItem,
  type RegistryItemType,
} from "./types";
export { type VendOptions, type VendResult, vendFiles } from "./vend";

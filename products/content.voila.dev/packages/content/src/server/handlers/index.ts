/**
 * Barrel for the read handlers. Filenames mirror the TanStack Router file
 * route they back, one handler per file.
 */

export { handleFindById } from "./admin.api.$collection.$id.ts";
export { handleFindByField } from "./admin.api.$collection.by.$field.$value.ts";
export { handleList } from "./admin.api.$collection.ts";
export type { ReadHandlerContext } from "./shared.ts";

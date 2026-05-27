/**
 * Barrel for the request handlers. Filenames mirror the TanStack Router file
 * route they back; where a method shares a route path with another (e.g.
 * create shares `/$collection` with list), the file is suffixed with the
 * operation. One handler per file.
 */

export { handleDelete } from "./admin.api.$collection.$id.delete.ts";
export { handleRestore } from "./admin.api.$collection.$id.restore.ts";
export { handleFindById } from "./admin.api.$collection.$id.ts";
export { handleUpdate } from "./admin.api.$collection.$id.update.ts";
export { handleFindByField } from "./admin.api.$collection.by.$field.$value.ts";
export { handleCreate } from "./admin.api.$collection.create.ts";
export { handleList } from "./admin.api.$collection.ts";
export { type CsrfTokenContext, handleCsrfToken } from "./admin.api.csrf.ts";
export type { ApiSessionResolver, ReadHandlerContext, WriteHandlerContext } from "./shared.ts";

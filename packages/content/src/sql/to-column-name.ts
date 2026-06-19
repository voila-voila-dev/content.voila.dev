// camelCase → snake_case. Used for every user-defined field; system columns
// (`id`, `created_at`, etc.) are already snake_case at their source.

const BOUNDARY = /([a-z0-9])([A-Z])/g;

export const toColumnName = (name: string): string => name.replace(BOUNDARY, "$1_$2").toLowerCase();

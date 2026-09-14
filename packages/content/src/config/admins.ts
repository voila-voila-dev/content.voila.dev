// The conventional "who may sign in" collection for the collection-backed
// allowlist (`allowlistAccess` in `@voila/content/server`). One string field of
// email addresses plus a display name; editors manage it from the admin like any
// other collection. Every label is overridable so a French admin can call it
// « Administrateurs » without redefining the fields.

import { defineCollection } from "./schema/collection";
import * as fields from "./schema/fields";

export interface AdminsCollectionOptions {
  /** Collection slug (and table name). Default `admins`. */
  readonly slug?: string;
  readonly label?: string;
  readonly labelSingular?: string;
  /** Phosphor icon name for the sidebar. Default `UserCircle`. */
  readonly icon?: string;
  /** Sidebar group. Default `Settings`. */
  readonly group?: string;
  /** Help text shown under the email field. */
  readonly emailDescription?: string;
}

/**
 * Declare the admins collection. Pass the returned collection to `defineConfig`
 * under the same slug you give `allowlistAccess` (default `admins`).
 */
export function defineAdminsCollection(options: AdminsCollectionOptions = {}) {
  return defineCollection({
    slug: options.slug ?? "admins",
    label: options.label ?? "Administrators",
    labelSingular: options.labelSingular ?? "Administrator",
    icon: options.icon ?? "UserCircle",
    group: options.group ?? "Settings",
    titleField: "email",
    fields: {
      email: fields.string({
        required: true,
        max: 200,
        description: options.emailDescription ?? "Address that receives the sign-in link.",
      }),
      name: fields.string({ max: 100 }),
    },
  });
}

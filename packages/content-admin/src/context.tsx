// The admin instance + signed-in user, shared through React context so every
// generic and custom screen reads the same typed client, config, widgets, and
// slots. Provided once at the app root by `<AdminProvider>`.

import type { NormalizedConfig } from "@voila/content";
import { createContext, type ReactNode, useContext } from "react";
import type { AdminBrandSource, AdminInstance, AdminUser } from "./types";

interface AdminContextValue<C extends NormalizedConfig = NormalizedConfig> {
  readonly admin: AdminInstance<C>;
  readonly user?: AdminUser;
  /** Brand values read from the project's content this request (logo, accent).
   *  Provided at the document root; nested providers inherit it. */
  readonly brand?: AdminBrandSource;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export interface AdminProviderProps<C extends NormalizedConfig = NormalizedConfig> {
  readonly admin: AdminInstance<C>;
  /** The signed-in user, resolved by the `/admin` guard. */
  readonly user?: AdminUser;
  /** Brand values read from content (see `readBrandSource`). Set this on the
   *  root provider; the guard layout's nested provider inherits it. */
  readonly brand?: AdminBrandSource;
  readonly children: ReactNode;
}

export function AdminProvider<C extends NormalizedConfig>({
  admin,
  user,
  brand,
  children,
}: AdminProviderProps<C>): ReactNode {
  // The admin nests providers — the document root provides the instance, the
  // authed layout re-provides it with the resolved user — so an inner provider
  // must not blank out the brand the outer one already resolved.
  const inherited = useContext(AdminContext);
  const value = {
    admin: admin as unknown as AdminInstance,
    user: user ?? inherited?.user,
    brand: brand ?? inherited?.brand,
  };
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

/** Read the admin instance, current user and resolved brand. Throws outside an
 *  `AdminProvider`. */
export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (value === null) {
    throw new Error("useAdmin must be used within an <AdminProvider>.");
  }
  return value;
}

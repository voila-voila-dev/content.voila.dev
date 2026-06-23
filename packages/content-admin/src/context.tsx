// The admin instance + signed-in user, shared through React context so every
// generic and custom screen reads the same typed client, config, widgets, and
// slots. Provided once at the app root by `<AdminProvider>`.

import type { NormalizedConfig } from "@voila/content";
import { createContext, type ReactNode, useContext } from "react";
import type { AdminInstance, AdminUser } from "./types";

interface AdminContextValue<C extends NormalizedConfig = NormalizedConfig> {
  readonly admin: AdminInstance<C>;
  readonly user?: AdminUser;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export interface AdminProviderProps<C extends NormalizedConfig = NormalizedConfig> {
  readonly admin: AdminInstance<C>;
  /** The signed-in user, resolved by the `/admin` guard. */
  readonly user?: AdminUser;
  readonly children: ReactNode;
}

export function AdminProvider<C extends NormalizedConfig>({
  admin,
  user,
  children,
}: AdminProviderProps<C>): ReactNode {
  return (
    <AdminContext.Provider value={{ admin: admin as unknown as AdminInstance, user }}>
      {children}
    </AdminContext.Provider>
  );
}

/** Read the admin instance + current user. Throws outside an `AdminProvider`. */
export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (value === null) {
    throw new Error("useAdmin must be used within an <AdminProvider>.");
  }
  return value;
}

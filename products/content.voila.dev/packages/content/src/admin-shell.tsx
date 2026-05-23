import type { ResolvedContentConfig } from "./types.ts";

/**
 * Body fragment for the admin route. Returns the SPA mount point; the
 * surrounding `<html>` / `<head>` is contributed by the root route +
 * `buildAdminHead(content)` so this stays composable inside TanStack
 * Router's tree.
 */
export function AdminShell({ config }: { config: ResolvedContentConfig }) {
  const name = config.branding.name ?? "Voila";
  return (
    <div
      id="voila-admin"
      data-mount-admin={config.mount.admin}
      data-mount-api={config.mount.api}
      data-brand-name={name}
    />
  );
}

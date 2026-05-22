import type { ResolvedContentConfig } from "./types.ts";

/**
 * Body fragment for the first-run setup route. The surrounding
 * `<html>` / `<head>` is contributed by the root route +
 * `buildSetupHead(content)`.
 */
export function SetupPage({ config }: { config: ResolvedContentConfig }) {
  const name = config.branding.name ?? "Voila";
  return (
    <main id="voila-setup" data-brand-name={name}>
      <h1>Welcome to {name}</h1>
      <p>First-run setup is not implemented yet.</p>
    </main>
  );
}

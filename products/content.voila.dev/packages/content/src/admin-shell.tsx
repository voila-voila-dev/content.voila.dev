import type { ResolvedContentConfig } from "./types.ts";

export function AdminShell({ config }: { config: ResolvedContentConfig }) {
  const name = config.branding.name ?? "Voila";
  const { favicon, accent } = config.branding;
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{name}</title>
        {favicon ? <link rel="icon" href={favicon} /> : null}
        <meta name="voila:mount-admin" content={config.mount.admin} />
        <meta name="voila:mount-api" content={config.mount.api} />
        {accent ? <style>{`:root { --voila-color-accent: ${accent}; }`}</style> : null}
      </head>
      <body>
        <div
          id="voila-admin"
          data-mount-admin={config.mount.admin}
          data-mount-api={config.mount.api}
          data-brand-name={name}
        />
      </body>
    </html>
  );
}

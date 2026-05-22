import type { ResolvedContentConfig } from "./types.ts";

export function SetupPage({ config }: { config: ResolvedContentConfig }) {
  const name = config.branding.name ?? "Voila";
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`Setup — ${name}`}</title>
      </head>
      <body>
        <main id="voila-setup" data-brand-name={name}>
          <h1>Welcome to {name}</h1>
          <p>First-run setup is not implemented yet.</p>
        </main>
      </body>
    </html>
  );
}

// VENDED by @voila/content-registry — you own this file.
// The empty M0 admin shell. Replace/extend freely.
import { createFileRoute } from "@tanstack/react-router";
import config from "~/content.config";

export const Route = createFileRoute("/admin/$")({
  component: AdminShell,
});

function AdminShell() {
  const branding = config.branding ?? { name: "voila" };
  return (
    <main>
      <h1>Hello {branding.name}</h1>
    </main>
  );
}

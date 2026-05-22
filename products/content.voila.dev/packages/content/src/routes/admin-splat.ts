export function adminSplatSource(configImport: string): string {
  return `import { createFileRoute } from "@tanstack/react-router";
import { AdminShell, buildAdminHead } from "@voila/content/internal";
import content from "${configImport}";

export const Route = createFileRoute("/admin/$")({
  head: () => buildAdminHead(content),
  component: () => <AdminShell config={content} />,
});
`;
}

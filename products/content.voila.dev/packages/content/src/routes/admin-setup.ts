export function adminSetupSource(configImport: string): string {
  return `import { createFileRoute } from "@tanstack/react-router";
import { buildSetupHead, SetupPage } from "@voila/content/internal";
import content from "${configImport}";

export const Route = createFileRoute("/admin/setup")({
  head: () => buildSetupHead(content),
  component: () => <SetupPage config={content} />,
});
`;
}

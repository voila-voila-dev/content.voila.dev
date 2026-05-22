export function healthRouteSource(): string {
  return `import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/api/health")({
  server: {
    handlers: {
      GET: () =>
        Response.json({
          ok: true,
          name: "@voila/content",
          time: new Date().toISOString(),
        }),
    },
  },
});
`;
}

export function healthRouteSource(): string {
  return `import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/api/health")({
  server: {
    handlers: {
      GET: () =>
        Response.json({
          ok: true,
          time: new Date().toISOString(),
        }),
    },
  },
});
`;
}

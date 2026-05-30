import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import config from "~/content.config";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

const collections = Object.values(config.collections);

function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{config.branding?.name ?? "voila"}</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {collections.map((collection) => (
          <Link
            key={collection.slug}
            to="/admin/$collection"
            params={{ collection: collection.slug }}
          >
            <Card className="transition-colors hover:bg-accent">
              <CardHeader>
                <CardTitle>{collection.label ?? collection.slug}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

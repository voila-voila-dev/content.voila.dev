// VENDED by @voila/content-registry — you own this file.
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import config from "~/content.config";
import { signOut } from "~/lib/auth";

const collections = Object.values(config.collections);

export function Sidebar() {
  const navigate = useNavigate();
  return (
    <aside className="flex w-60 shrink-0 flex-col gap-1 border-r p-4">
      <Link to="/admin" className="mb-4 px-2 text-lg font-semibold">
        {config.branding?.name ?? "voila"}
      </Link>
      <nav className="flex flex-1 flex-col gap-0.5">
        {collections.map((collection) => (
          <Link
            key={collection.slug}
            to="/admin/$collection"
            params={{ collection: collection.slug }}
            className="rounded-md px-2 py-1.5 text-sm hover:bg-accent data-[status=active]:bg-accent data-[status=active]:font-medium"
            activeProps={{ "data-status": "active" }}
          >
            {collection.label ?? collection.slug}
          </Link>
        ))}
      </nav>
      <Button
        variant="ghost"
        className="justify-start"
        onClick={async () => {
          await signOut();
          navigate({ to: "/login" });
        }}
      >
        Sign out
      </Button>
    </aside>
  );
}

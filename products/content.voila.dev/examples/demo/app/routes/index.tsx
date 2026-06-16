import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold">demo</h1>
      <p className="text-muted-foreground">
        Your content engine is wired. Head to the admin to manage your collections.
      </p>
      <Link to="/admin" className="text-primary underline-offset-4 hover:underline">
        Open the admin →
      </Link>
    </main>
  );
}

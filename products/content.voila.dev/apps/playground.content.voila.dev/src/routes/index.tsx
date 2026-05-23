import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Voila Playground" }] }),
  component: Home,
});

function Home() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Voila Playground</h1>
      <p className="mt-4 text-lg">
        Canary app for <code>@voila/content</code>. Open{" "}
        <Link to="/admin/$" params={{ _splat: "" }} className="underline">
          /admin
        </Link>{" "}
        to see the admin shell.
      </p>
    </div>
  );
}

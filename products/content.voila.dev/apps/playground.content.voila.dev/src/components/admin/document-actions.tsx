// VENDED by @voila/content-registry — you own this file.
// Edit + Delete actions on the document detail view. Edit links to the form route;
// Delete soft-deletes through the CSRF-armed write client and returns to the list.

import { Link, useNavigate } from "@tanstack/react-router";
import type { AsyncCollectionClient } from "@voila/content/client";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import type { AnyDoc } from "~/lib/admin";
import { withWriteClient } from "~/lib/voila-write";

export function DocumentActions({ slug, id }: { readonly slug: string; readonly id: string }) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!window.confirm("Delete this document?")) return;
    setDeleting(true);
    setError(null);
    try {
      await withWriteClient((client) =>
        (client as unknown as Record<string, AsyncCollectionClient<AnyDoc>>)[slug].delete({ id }),
      );
      navigate({ to: "/admin/$collection", params: { collection: slug } });
    } catch {
      setError("Delete failed. Try again.");
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Link to="/admin/$collection/$id/edit" params={{ collection: slug, id }}>
        <Button variant="outline">Edit</Button>
      </Link>
      <Button variant="outline" disabled={deleting} onClick={remove} data-testid="delete-button">
        {deleting ? "Deleting…" : "Delete"}
      </Button>
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
    </div>
  );
}

// VENDED by @voila/content-registry — you own this file.
// Loading / empty / error states shared by the collection views.
import { Link } from "@tanstack/react-router";
import { Skeleton } from "~/components/ui/skeleton";

export function TableSkeleton({ columns = 3, rows = 5 }: { columns?: number; rows?: number }) {
  return (
    <div className="space-y-2" data-testid="table-skeleton">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded-lg border border-dashed p-12 text-center text-muted-foreground"
      data-testid="empty-state"
    >
      {message}
    </div>
  );
}

export function ErrorState({ message, unauthorized }: { message: string; unauthorized?: boolean }) {
  return (
    <div
      className="rounded-lg border border-destructive/40 p-6 text-center"
      data-testid="error-state"
    >
      <p className="text-sm text-destructive">{message}</p>
      {unauthorized ? (
        <Link
          to="/login"
          className="mt-4 inline-flex rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Go to login
        </Link>
      ) : null}
    </div>
  );
}

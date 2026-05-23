import { cn, Skeleton, Table } from "@voila/ui";

/**
 * Loading skeletons sized to the final layout to keep cumulative-layout-shift
 * to zero. The list skeleton draws `rows × cols` placeholder cells; the detail
 * skeleton stacks N field-row skeletons.
 */

export interface ListSkeletonProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function ListSkeleton({ rows = 6, cols = 4, className }: ListSkeletonProps) {
  return (
    <Table.Root className={className}>
      <Table.Header>
        <Table.Row>
          {Array.from({ length: cols }).map((_, i) => (
            <Table.Head key={`h-${i}`}>
              <Skeleton className="h-4 w-20" />
            </Table.Head>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {Array.from({ length: rows }).map((_, r) => (
          <Table.Row key={`r-${r}`}>
            {Array.from({ length: cols }).map((_, c) => (
              <Table.Cell key={`c-${c}`}>
                <Skeleton className="h-4 w-full max-w-48" />
              </Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

export interface DetailSkeletonProps {
  fields?: number;
  className?: string;
}

export function DetailSkeleton({ fields = 5, className }: DetailSkeletonProps) {
  return (
    <div className={cn("grid gap-6", className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={`f-${i}`} className="grid gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-full max-w-md" />
        </div>
      ))}
    </div>
  );
}

// VENDED by @voila/content-registry — you own this file.
// Collection list view: a TanStack Table whose columns come from the collection's
// fields and whose rows are fed by the `list` atom. Rows link to the detail view.
import { Result } from "@effect-atom/atom";
import { useAtomValue } from "@effect-atom/atom-react";
import { Link } from "@tanstack/react-router";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Cause, Option } from "effect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { type AnyDoc, atomsFor, describeFailure, fieldKeysFor } from "~/lib/admin";
import { FieldValue } from "./field-value";
import { EmptyState, ErrorState, TableSkeleton } from "./states";

const columnHelper = createColumnHelper<AnyDoc>();

// `slug` is validated by the route (`notFound()` otherwise), so the atom set and
// field keys are always present here.
export function CollectionTable({ slug }: { slug: string }) {
  const fieldKeys = fieldKeysFor(slug);
  // biome-ignore lint/style/noNonNullAssertion: the route validated the slug.
  const atoms = atomsFor(slug)!;
  const result = useAtomValue(atoms.list({ limit: 50 }));

  const columns = [
    columnHelper.accessor("id", {
      header: "ID",
      cell: (c) => <code className="text-xs">{c.getValue()}</code>,
    }),
    ...fieldKeys.map((key) =>
      columnHelper.accessor((row) => row[key], {
        id: key,
        header: key,
        cell: (c) => <FieldValue value={c.getValue()} />,
      }),
    ),
  ];

  const rows: ReadonlyArray<AnyDoc> = Result.isSuccess(result) ? result.value.documents : [];
  const table = useReactTable({
    data: rows as AnyDoc[],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (Result.isFailure(result)) {
    const { message, unauthorized } = describeFailure(
      Option.getOrNull(Cause.failureOption(result.cause)),
    );
    return <ErrorState message={message} unauthorized={unauthorized} />;
  }
  if (!Result.isSuccess(result)) return <TableSkeleton columns={fieldKeys.length + 1} />;
  if (rows.length === 0) return <EmptyState message="No documents yet." />;

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => (
              <TableHead key={header.id}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id} data-clickable>
            {row.getVisibleCells().map((cell, i) => (
              <TableCell key={cell.id}>
                {i === 0 ? (
                  <Link
                    to="/admin/$collection/$id"
                    params={{ collection: slug, id: row.original.id }}
                    className="font-mono text-xs underline-offset-2 hover:underline"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Link>
                ) : (
                  flexRender(cell.column.columnDef.cell, cell.getContext())
                )}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// VENDED by @voila/content-registry — you own this file.
// Read-only document detail: every column rendered as a label/value row.
import { Result } from "@effect-atom/atom";
import { useAtomValue } from "@effect-atom/atom-react";
import { Cause, Option } from "effect";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { type AnyDoc, atomsFor, describeFailure, fieldKeysFor } from "~/lib/admin";
import { FieldValue } from "./field-value";
import { ErrorState } from "./states";

const SYSTEM_KEYS = ["id", "createdAt", "updatedAt", "deletedAt"] as const;

export function CollectionDetail({ slug, id }: { slug: string; id: string }) {
  const fieldKeys = fieldKeysFor(slug);
  // biome-ignore lint/style/noNonNullAssertion: the route validated the slug.
  const atoms = atomsFor(slug)!;
  const result = useAtomValue(atoms.find(id));

  if (Result.isFailure(result)) {
    const { message, unauthorized } = describeFailure(
      Option.getOrNull(Cause.failureOption(result.cause)),
    );
    return <ErrorState message={message} unauthorized={unauthorized} />;
  }
  if (!Result.isSuccess(result)) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6">
          {Array.from({ length: fieldKeys.length + 2 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const doc: AnyDoc = result.value;
  const keys = [...fieldKeys, ...SYSTEM_KEYS];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono text-sm">{doc.id}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-3 text-sm">
          {keys.map((key) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">{key}</dt>
              <dd>
                <FieldValue value={doc[key]} />
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

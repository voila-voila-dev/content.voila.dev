// FieldRenderer — given a `Field` and its value, resolve the right display
// widget from the registry and render it. The single composition point every
// read surface (`DataTable` cells, `DetailView` rows, board/calendar cards)
// goes through, so two cross-cutting concerns live in exactly one place:
//
//   • Localized fields. A localized value is `Record<locale, T>`; the renderer
//     resolves it to ONE value through the shell's locale chain
//     (`resolveLocalized`) and renders the INNER field's widget on it — with a
//     small locale badge when the shown value came from a fallback locale.
//   • Render context. `context` tells the widget where it is (`cell` = a table
//     cell wanting a one-line preview, `card` = a board card line, `detail` = the
//     read view with room), so one widget can render a 24px thumbnail in a table
//     and a full-size preview on the detail page.

import type { Field } from "@voila/content";
import { Badge } from "@voila.dev/ui/badge";
import type { ReactNode } from "react";
import { resolveLocalized, useI18n } from "./lib/i18n";
import {
  type DisplayRegistry,
  defaultDisplayRegistry,
  resolveDisplayWidget,
} from "./registry/registry";
import type { DisplayContext } from "./widgets/display";

export interface FieldRendererProps {
  readonly field: Field;
  readonly value: unknown;
  /** Override widgets per kind/name; merged over the defaults by the caller. */
  readonly registry?: DisplayRegistry;
  /** Where the value renders; widgets adapt density/size. Defaults to `detail`. */
  readonly context?: DisplayContext;
}

export function FieldRenderer({
  field,
  value,
  registry = defaultDisplayRegistry,
  context = "detail",
}: FieldRendererProps): ReactNode {
  const i18n = useI18n();
  if (field.meta.localized === true) {
    const inner = field.inner ?? field;
    const resolved = resolveLocalized(value, i18n);
    const Widget = resolveDisplayWidget(inner.meta, registry);
    const shown = <Widget value={resolved.value} meta={inner.meta} context={context} />;
    if (!resolved.fallback || resolved.locale === undefined) return shown;
    return (
      <span data-slot="localized-display" className="inline-flex max-w-full items-center gap-1.5">
        <span className="min-w-0">{shown}</span>
        <Badge
          variant="outline"
          className="shrink-0 px-1 py-0 font-mono text-[10px] uppercase"
          title={`Shown in ${resolved.locale} (no ${i18n.displayLocale ?? i18n.i18n?.defaultLocale ?? "default"} value)`}
        >
          {resolved.locale}
        </Badge>
      </span>
    );
  }
  const Widget = resolveDisplayWidget(field.meta, registry);
  return <Widget value={value} meta={field.meta} context={context} />;
}

// PreviewSplit — the document screen with the live preview beside it: the
// form (or read view) on the left, the site's preview frame on the right, in
// a resizable horizontal split. Each side owns its own header and scroll
// region (`PageLayout.Root` is a bounded flex column), so the pinned form
// header stays put while the fields scroll. The split's width is remembered
// per slug in `localStorage`, and so is whether the pane is shown at all
// (`usePreviewToggle`, driven by the header's `PreviewToggle`); the pane only
// renders on desktop — below 1024px the host renders the plain form. The
// `src` is derived from the document, so an edited slug moves the frame to
// the new URL. When `open` is false the split renders its child bare, in the
// same tree position, so hiding the pane never remounts the form (and never
// loses what the editor typed).

import { type Doc, type FocusPath, PreviewPane, useMediaQuery } from "@voila/content-ui";
import { Resizable } from "@voila.dev/ui/resizable";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import type { PreviewTarget } from "../types";

/** The desktop breakpoint the pane requires (matches the sidebar's). */
export const PREVIEW_MEDIA_QUERY = "(min-width: 1024px)";

const DEFAULT_SIZE = 50;
const MIN_SIZE = 20;

function storageKey(slug: string): string {
  return `voila:preview-size:${slug}`;
}

/** The remembered preview width for `slug`, else the configured default. */
export function readPreviewSize(slug: string, fallback: number | undefined): number {
  const base = clamp(fallback ?? DEFAULT_SIZE);
  try {
    const raw = globalThis.localStorage?.getItem(storageKey(slug));
    const stored = raw === null || raw === undefined ? Number.NaN : Number(raw);
    return Number.isFinite(stored) ? clamp(stored) : base;
  } catch {
    return base;
  }
}

export function writePreviewSize(slug: string, size: number): void {
  try {
    globalThis.localStorage?.setItem(storageKey(slug), String(clamp(size)));
  } catch {
    // Private mode or a full store: the split just isn't remembered.
  }
}

function openKey(slug: string): string {
  return `voila:preview-open:${slug}`;
}

/** Whether the pane was left open for `slug`; `fallback` when never toggled. */
export function readPreviewOpen(slug: string, fallback = true): boolean {
  try {
    const raw = globalThis.localStorage?.getItem(openKey(slug));
    return raw === "1" ? true : raw === "0" ? false : fallback;
  } catch {
    return fallback;
  }
}

export function writePreviewOpen(slug: string, open: boolean): void {
  try {
    globalThis.localStorage?.setItem(openKey(slug), open ? "1" : "0");
  } catch {
    // Private mode or a full store: the choice just isn't remembered.
  }
}

/** The pane's shown / hidden state for `slug`, remembered across visits. */
export function usePreviewToggle(slug: string): {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
} {
  const [open, setOpen] = useState(() => readPreviewOpen(slug));
  useEffect(() => writePreviewOpen(slug, open), [slug, open]);
  return { open, setOpen };
}

function clamp(size: number): number {
  return Math.min(100 - MIN_SIZE, Math.max(MIN_SIZE, Math.round(size)));
}

/** Whether the preview pane can render right now (configured + desktop). */
export function usePreviewAvailable(target: PreviewTarget | undefined): boolean {
  const desktop = useMediaQuery(PREVIEW_MEDIA_QUERY);
  return target !== undefined && desktop;
}

export interface PreviewSplitProps {
  readonly slug: string;
  readonly target: PreviewTarget;
  /** Whether the pane is shown; `false` renders `children` alone. Default `true`. */
  readonly open?: boolean;
  /** The document to preview — the form's live values, or the stored row. */
  readonly doc: Readonly<Doc>;
  readonly focus?: FocusPath | null;
  /** The left side: the form or the read view. */
  readonly children: ReactNode;
}

export function PreviewSplit({
  slug,
  target,
  open = true,
  doc,
  focus,
  children,
}: PreviewSplitProps): ReactNode {
  const [initial] = useState(() => readPreviewSize(slug, target.size));
  const onLayoutChanged = useCallback(
    (layout: Record<string, number>) => {
      const size = layout.preview;
      if (typeof size === "number") writePreviewSize(slug, size);
    },
    [slug],
  );
  // The document panel keeps the same ancestors whether or not the pane is
  // shown — only the handle and the preview panel come and go — so toggling
  // never remounts the form (and never loses what the editor typed). Closed,
  // the lone panel simply spans the whole width.
  return (
    <Resizable.Root
      data-slot="preview-split"
      data-state={open ? "open" : "closed"}
      orientation="horizontal"
      className="min-h-0 flex-1"
      onLayoutChanged={open ? onLayoutChanged : undefined}
    >
      <Resizable.Panel
        id="document"
        defaultSize={open ? `${100 - initial}` : "100"}
        minSize={`${MIN_SIZE}`}
        className="flex min-h-0 flex-col"
      >
        {children}
      </Resizable.Panel>
      {open ? (
        <>
          <Resizable.Handle withHandle />
          <Resizable.Panel
            id="preview"
            defaultSize={`${initial}`}
            minSize={`${MIN_SIZE}`}
            className="flex min-h-0 flex-col"
          >
            <PreviewPane src={target.url(doc)} doc={doc} focus={focus} />
          </Resizable.Panel>
        </>
      ) : null}
    </Resizable.Root>
  );
}

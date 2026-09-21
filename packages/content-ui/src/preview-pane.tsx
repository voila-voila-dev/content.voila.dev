// PreviewPane — the live preview beside an edit form: an iframe on the site's
// own preview route, fed the document over `postMessage` as it is edited.
// Protocol (same origin, both ways):
//   frame → parent  { type: "voila:preview:listening" }        once mounted
//   parent → frame  { type: "voila:preview", doc, seq, focus? } on every change
//   frame → parent  { type: "voila:preview:ready", seq }        once rendered
// The pane never reads the database and the frame never fetches drafts: the
// form pushes its values, so what the editor sees is exactly what is typed,
// saved or not. Messages from another origin or another window are ignored.
// Posts are debounced (a keystroke burst becomes one render) and tagged with
// a sequence so the "Updating…" hint clears on the matching reply only.

import {
  ArrowSquareOutIcon,
  ArrowsClockwiseIcon,
  DesktopIcon,
  DeviceMobileIcon,
} from "@phosphor-icons/react";
import { Button } from "@voila.dev/ui/button";
import { cn } from "@voila.dev/ui/utils";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { Doc } from "./lib/doc";
import type { FocusPath } from "./lib/focus-path";

export const PREVIEW_MESSAGE = "voila:preview";
export const PREVIEW_LISTENING = `${PREVIEW_MESSAGE}:listening`;
export const PREVIEW_READY = `${PREVIEW_MESSAGE}:ready`;

/** How long a burst of edits is coalesced before the frame re-renders. */
export const PREVIEW_DEBOUNCE_MS = 150;

export type PreviewDevice = "desktop" | "mobile";

/** Viewport widths of the device toggle (CSS pixels of the frame). */
export const PREVIEW_DEVICE_WIDTH: Record<PreviewDevice, number | undefined> = {
  desktop: undefined,
  mobile: 390,
};

export interface PreviewPaneProps {
  /** Same-origin path of the site's preview surface. A change reloads the frame. */
  readonly src: string;
  /** The document to render — the form's current values. */
  readonly doc: Readonly<Doc>;
  /** The nested row the editor has open, forwarded for the site to scroll to. */
  readonly focus?: FocusPath | null;
  /** The origin the channel talks to. Defaults to this document's. */
  readonly origin?: string;
  readonly className?: string;
}

interface PreviewMessage {
  readonly type: typeof PREVIEW_MESSAGE;
  readonly doc: Readonly<Doc>;
  readonly seq: number;
  readonly focus?: FocusPath;
}

/** This document's origin — the only one the channel talks to by default. */
function ownOrigin(): string | undefined {
  const origin = globalThis.location?.origin;
  return typeof origin === "string" && origin !== "null" && origin !== "" ? origin : undefined;
}

function messageType(data: unknown): string | undefined {
  return typeof data === "object" &&
    data !== null &&
    typeof (data as { type?: unknown }).type === "string"
    ? (data as { type: string }).type
    : undefined;
}

/**
 * The messaging half of the pane, on its own so it can be tested against a
 * fake frame: waits for the frame to announce itself, then posts the latest
 * document (debounced) and tracks whether a render is still pending.
 */
export function usePreviewChannel(
  frame: React.RefObject<HTMLIFrameElement | null>,
  doc: Readonly<Doc>,
  focus: FocusPath | null | undefined,
  originOverride?: string,
): { readonly pending: boolean; readonly listening: boolean } {
  const [listening, setListening] = useState(false);
  const [pending, setPending] = useState(false);
  const seq = useRef(0);
  const acked = useRef(0);
  const latest = useRef<{ doc: Readonly<Doc>; focus: FocusPath | null | undefined }>({
    doc,
    focus,
  });
  latest.current = { doc, focus };

  const post = useCallback(() => {
    const target = frame.current?.contentWindow;
    const origin = originOverride ?? ownOrigin();
    if (!target || origin === undefined) return;
    seq.current += 1;
    const message: PreviewMessage = {
      type: PREVIEW_MESSAGE,
      doc: latest.current.doc,
      seq: seq.current,
      ...(latest.current.focus ? { focus: latest.current.focus } : {}),
    };
    setPending(true);
    target.postMessage(message, origin);
  }, [frame, originOverride]);

  // The frame's handshake and its render acknowledgements.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const origin = originOverride ?? ownOrigin();
      if (origin === undefined || event.origin !== origin) return;
      if (event.source !== frame.current?.contentWindow) return;
      const type = messageType(event.data);
      if (type === PREVIEW_LISTENING) {
        setListening(true);
        post();
      } else if (type === PREVIEW_READY) {
        const reply = (event.data as { seq?: unknown }).seq;
        if (typeof reply === "number" && reply >= acked.current) {
          acked.current = reply;
          if (reply === seq.current) setPending(false);
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frame, post, originOverride]);

  // Re-post on every document / focus change, coalesced.
  const first = useRef(true);
  useEffect(() => {
    if (!listening) return;
    if (first.current) {
      // The handshake already posted the mounting document.
      first.current = false;
      return;
    }
    const timer = setTimeout(post, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [listening, doc, focus, post]);

  return { pending, listening };
}

export function PreviewPane({ src, doc, focus, origin, className }: PreviewPaneProps): ReactNode {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  // Bumping the key remounts the iframe (reload) and restarts the handshake.
  const [generation, setGeneration] = useState(0);
  const { pending, listening } = usePreviewChannel(frame, doc, focus, origin);
  const width = PREVIEW_DEVICE_WIDTH[device];

  return (
    <div
      data-slot="preview-pane"
      className={cn("flex min-h-0 flex-1 flex-col bg-muted/40", className)}
    >
      <div
        data-slot="preview-toolbar"
        className="flex h-14 shrink-0 items-center gap-1 border-b border-border bg-background px-3"
      >
        <span className="mr-auto text-muted-foreground text-sm">
          Preview
          {listening && pending ? (
            <span data-slot="preview-pending" className="ml-2 text-xs">
              Updating…
            </span>
          ) : null}
        </span>
        <Button
          type="button"
          size="icon-xs"
          variant={device === "desktop" ? "secondary" : "ghost"}
          aria-label="Desktop width"
          aria-pressed={device === "desktop"}
          onClick={() => setDevice("desktop")}
        >
          <DesktopIcon aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant={device === "mobile" ? "secondary" : "ghost"}
          aria-label="Mobile width"
          aria-pressed={device === "mobile"}
          onClick={() => setDevice("mobile")}
        >
          <DeviceMobileIcon aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Reload preview"
          onClick={() => setGeneration((g) => g + 1)}
        >
          <ArrowsClockwiseIcon aria-hidden />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Open preview in a new tab"
          nativeButton={false}
          // biome-ignore lint/a11y/useAnchorContent: the icon child and aria-label are injected by the button
          render={<a href={src} target="_blank" rel="noreferrer" />}
        >
          <ArrowSquareOutIcon aria-hidden />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 justify-center overflow-auto p-0">
        <iframe
          key={`${src}#${generation}`}
          ref={frame}
          data-slot="preview-frame"
          src={src}
          title="Preview"
          sandbox="allow-scripts allow-same-origin allow-forms"
          className={cn(
            "h-full border-0 bg-background",
            width === undefined ? "w-full" : "shadow-sm",
          )}
          style={width === undefined ? undefined : { width }}
        />
      </div>
    </div>
  );
}

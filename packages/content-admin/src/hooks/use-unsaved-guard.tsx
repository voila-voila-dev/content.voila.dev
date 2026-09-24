// Blocks in-app navigation away from a form with unsaved edits, and renders the
// dialog that asks about it.
//
// `CollectionForm` already guards FULL-PAGE navigation (reload, tab close) with
// `beforeunload`, but it stays router-agnostic, so a client-side route change —
// clicking Cancel, a sidebar link, the back arrow — used to drop typed work
// silently. That is this hook's job: `@voila/content-admin` is the layer that
// owns the router, so the block lives here.
//
// Usage: hold the dirty flag the form reports, pass it in, and render the
// returned `dialog`. TanStack's `useBlocker` gives us `proceed`/`reset`, which
// map exactly onto Discard / Keep editing.

import { useBlocker } from "@tanstack/react-router";
import { useMessages } from "@voila/content-ui";
import { AlertDialog } from "@voila.dev/ui/alert-dialog";
import { Button } from "@voila.dev/ui/button";
import { type ReactNode, useCallback, useRef, useState } from "react";

export interface UnsavedGuard {
  /** Render this next to the form — it is `null` until a navigation is blocked. */
  readonly dialog: ReactNode;
  /** Pass to the form's `onDirtyChange`. */
  readonly setDirty: (dirty: boolean) => void;
  /** True while the form holds unsaved edits. */
  readonly dirty: boolean;
}

export interface UseUnsavedGuardOptions {
  /** What the user is about to lose, e.g. "post". Used in the dialog copy. */
  readonly label?: string;
  /** Save-and-leave, when the surface has a single form-level save. */
  readonly onSave?: () => Promise<void> | void;
}

export function useUnsavedGuard(options: UseUnsavedGuardOptions = {}): UnsavedGuard {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const { admin: m, common } = useMessages();

  // `useBlocker` lists `shouldBlockFn` in its effect deps, so a fresh closure
  // each render would tear the blocker down and re-register it on every
  // re-render — including the one its own `setResolver` causes, which cancels
  // the pending decision before the dialog can be answered. Reading the flag
  // through a ref keeps the callback identity stable for the life of the hook.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const shouldBlockFn = useCallback(() => dirtyRef.current, []);

  // `withResolver` hands back `proceed`/`reset` instead of blocking on a
  // window.confirm, so the prompt can be a real dialog.
  const { status, proceed, reset } = useBlocker({
    shouldBlockFn,
    withResolver: true,
    enableBeforeUnload: false,
  });

  const blocked = status === "blocked";

  const handleSave = useCallback(async () => {
    if (options.onSave === undefined) return;
    setSaving(true);
    try {
      await options.onSave();
      // The form clears its own dirty flag on a successful save, but the
      // blocker captured the old value — release it explicitly.
      setDirty(false);
      proceed?.();
    } finally {
      setSaving(false);
    }
  }, [options.onSave, proceed]);

  const dialog = blocked ? (
    <AlertDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) reset?.();
      }}
    >
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>{m.leaveTitle}</AlertDialog.Title>
          <AlertDialog.Description>{m.leaveDescription(options.label)}</AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <Button variant="ghost" size="sm" onClick={() => reset?.()}>
            {m.keepEditing}
          </Button>
          {options.onSave ? (
            <Button size="sm" disabled={saving} onClick={handleSave}>
              {saving ? common.saving : m.saveAndLeave}
            </Button>
          ) : null}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setDirty(false);
              proceed?.();
            }}
          >
            {m.discardChanges}
          </Button>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  ) : null;

  return { dialog, setDirty, dirty };
}

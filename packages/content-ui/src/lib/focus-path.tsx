// focus-path — which nested row the editor has open, as a path into the
// document (`["blocks", 2]`, `["items", 0, "actions", 1]`). The form provides
// the root and the field key; every `SortableList` extends it with its row
// index when a row expands, and reports the result back up. The host relays
// it to the live preview, which can scroll to the matching section. With no
// provider the context is a no-op, so widgets render unchanged in isolation.

import { createContext, type ReactNode, useContext, useMemo } from "react";

export type FocusPath = ReadonlyArray<string | number>;

interface FocusPathContextValue {
  /** The path of the enclosing field / row. */
  readonly path: FocusPath;
  /** Report the row the user just expanded (`null` when it collapsed). */
  readonly report: (path: FocusPath | null) => void;
}

const FocusPathContext = createContext<FocusPathContextValue | null>(null);

export interface FocusPathProviderProps {
  /** Path segment(s) this subtree adds to the enclosing path. */
  readonly path: FocusPath;
  /** The root's sink; nested providers inherit the parent's. */
  readonly onChange?: (path: FocusPath | null) => void;
  readonly children: ReactNode;
}

export function FocusPathProvider({ path, onChange, children }: FocusPathProviderProps): ReactNode {
  const parent = useContext(FocusPathContext);
  // Keyed on the path's text so an inline `path={[key]}` literal keeps the
  // context value stable across renders.
  const pathKey = path.join("\u0000");
  const value = useMemo<FocusPathContextValue>(() => {
    const full = [...(parent?.path ?? []), ...path];
    const report = onChange ?? parent?.report ?? (() => {});
    return { path: full, report };
  }, [parent, pathKey, onChange]);
  return <FocusPathContext.Provider value={value}>{children}</FocusPathContext.Provider>;
}

/** The enclosing path and the sink; `null` outside any provider. */
export function useFocusPath(): FocusPathContextValue | null {
  return useContext(FocusPathContext);
}

// Registry contexts — how a container widget (blocks, array, object) resolves
// the widgets of the fields nested inside it. `CollectionForm` and
// `FieldRenderer` provide the registry they were handed, so a host that injects
// `media` / `relation` / `richText` widgets through `defineAdmin` sees them
// applied at any depth without every widget forwarding a prop. Outside a
// provider the defaults apply, so a widget rendered standalone still works.

import { createContext, type ReactNode, useContext } from "react";
import { defaultEditRegistry, type EditRegistry } from "./edit";
import { type DisplayRegistry, defaultDisplayRegistry } from "./registry";

// The contexts hold `null` rather than the default registries: the registries
// import the structured widgets, which import this module — reading a default
// at module-evaluation time would hit that cycle before it is initialised. The
// hooks resolve the default lazily instead.
const EditRegistryContext = createContext<EditRegistry | null>(null);
const DisplayRegistryContext = createContext<DisplayRegistry | null>(null);

export function EditRegistryProvider({
  registry,
  children,
}: {
  readonly registry: EditRegistry;
  readonly children: ReactNode;
}): ReactNode {
  return <EditRegistryContext.Provider value={registry}>{children}</EditRegistryContext.Provider>;
}

/** The edit registry in scope — the form's merged registry, else the defaults. */
export function useEditRegistry(): EditRegistry {
  return useContext(EditRegistryContext) ?? defaultEditRegistry;
}

export function DisplayRegistryProvider({
  registry,
  children,
}: {
  readonly registry: DisplayRegistry;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <DisplayRegistryContext.Provider value={registry}>{children}</DisplayRegistryContext.Provider>
  );
}

/** The display registry in scope — the renderer's registry, else the defaults. */
export function useDisplayRegistry(): DisplayRegistry {
  return useContext(DisplayRegistryContext) ?? defaultDisplayRegistry;
}

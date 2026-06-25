// @voila/content — field groups for the admin detail/edit layout.
//
// A collection or singleton may declare `groups`: an ordered list of field
// groups rendered as a left sub-nav on the detail/edit page. Both group order
// and field order fall out of array order, so authors never set numeric `order`
// indices. Fields omitted from every group fall into a synthesized trailing
// "General" group (see `resolveFieldGroups` in `@voila/content-ui`), so nothing
// disappears when only some fields are grouped. With no `groups` at all the UI
// keeps its flat behavior.

/**
 * One field group on a collection/singleton's detail page.
 *
 * `Keys` is bound to the owning entity's field keys at the authoring site
 * (`defineCollection`/`defineSingleton` type their `groups[].fields` as
 * `GroupDef<keyof Fields & string>`), so a typo in a grouped field key is a
 * compile error. The stored `GroupDef` on `CollectionDef`/`SingletonDef` widens
 * `Keys` back to `string` — the same variance trick `titleField` uses, keeping
 * `Fields` covariant so `Collection<…> extends Collection` still holds.
 */
export interface GroupDef<Keys extends string = string> {
  /** Stable id, used in the `?group=` URL and as the nav/React key. */
  readonly id: string;
  /** Display label; defaults to `humanize(id)` when unset. */
  readonly label?: string;
  /** Phosphor icon name (e.g. `"FileText"`); an unknown name renders no icon. */
  readonly icon?: string;
  /** Optional one-line description shown under the group heading. */
  readonly description?: string;
  /** Field keys in this group, in render order. */
  readonly fields: ReadonlyArray<Keys>;
}

import type { AnyFieldDef } from "@voila/content-schema";
import type { ComponentType } from "react";

/**
 * The controlled, form-library-agnostic contract every widget implements.
 *
 * The host (the `FieldWidget` wrapper, a TanStack Form row in the M2 form
 * layer, or a bare `useState` in a test) owns the value and feeds it back via
 * `onChange`. Widgets never reach into form state directly, so the same widget
 * renders identically under any host.
 */
export interface WidgetProps<TValue = unknown, TField extends AnyFieldDef = AnyFieldDef> {
  /** Stable DOM id, paired with the field's `<label htmlFor>`. */
  id: string;
  /** Field key within the collection (e.g. `"title"`). */
  name: string;
  /** The field definition this widget renders. */
  field: TField;
  /** Current value; `undefined` for an untouched/empty field. */
  value: TValue | undefined;
  /** Emit a new value. Emit `undefined` to clear. */
  onChange: (value: TValue | undefined) => void;
  /** Notify the host the control blurred (validate-on-blur / touched). */
  onBlur?: () => void;
  /** Disable input (submitting, RBAC read-only, …). */
  disabled?: boolean;
  /** Mark the control invalid for styling + `aria-invalid`. */
  invalid?: boolean;
  /** Id(s) of describing elements, wired to the control's `aria-describedby`. */
  describedBy?: string;
  /**
   * Sibling values of the document being edited, read-only. Widgets that derive
   * from another field (`slug` from `title`) read here; most widgets ignore it.
   */
  doc?: Record<string, unknown>;
}

export type WidgetComponent<
  TValue = unknown,
  TField extends AnyFieldDef = AnyFieldDef,
> = ComponentType<WidgetProps<TValue, TField>>;

/** A registered widget: the field `kind` it serves + the component to render. */
export interface WidgetDef {
  readonly kind: string;
  readonly component: WidgetComponent;
}

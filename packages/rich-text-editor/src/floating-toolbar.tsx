import {
  flip,
  offset,
  shift,
  type UseVirtualFloatingOptions,
  useFloatingToolbar,
  useFloatingToolbarState,
} from "@platejs/floating";
import { useEditorId, useEventEditorValue } from "platejs/react";
import type { ReactNode } from "react";
import type { ToolbarModel } from "./content/capabilities.ts";
import { ToolbarSurface } from "./toolbar.tsx";

// Float above the selection by default, but stay on-screen: `flip` drops the bar
// below when there's no room above, and `shift` slides it along the edge so a
// wide bar never spills out of the viewport. A stable module constant — Plate's
// floating hook memoizes on this object's identity, so a per-render literal
// would rebuild the floating instance every render.
const FLOATING_OPTIONS: UseVirtualFloatingOptions = {
  placement: "top",
  middleware: [offset(8), flip(), shift({ padding: 8 })],
};

export interface RichTextFloatingToolbarProps {
  /**
   * The controls to show, already gated to what the field allows — build it with
   * `deriveToolbar(meta.elements, meta.marks)` (or `deriveMarkdownToolbar`) from
   * `@voila/rich-text-editor/content`, the same model the fixed
   * {@link RichTextToolbar} takes.
   */
  model: ToolbarModel;
  /** Accessible name for the toolbar landmark. Defaults to "Selection formatting". */
  label?: string;
  className?: string;
}

/**
 * A floating/selection formatting toolbar for {@link RichTextEditor}. Render it
 * as (part of) the editor's `toolbar` prop — alongside or instead of the fixed
 * {@link RichTextToolbar} — so it sits inside the Plate provider:
 *
 * ```tsx
 * <RichTextEditor toolbar={<RichTextFloatingToolbar model={toolbar} />} … />
 * ```
 *
 * It shows the same capability-gated controls as the fixed toolbar (turn-into
 * blocks + marks + lists, reflecting and toggling the current selection), but
 * only appears over a non-collapsed selection and follows it. Visibility and
 * positioning come from Plate's floating hooks; the chrome and a11y are shared
 * with the fixed toolbar via {@link ToolbarSurface}. Hidden (renders nothing)
 * when the selection is collapsed, the editor is blurred, or it's read-only.
 */
export function RichTextFloatingToolbar({
  model,
  label = "Selection formatting",
  className = "voila-rich-text-floating-toolbar",
}: RichTextFloatingToolbarProps): ReactNode {
  const editorId = useEditorId();
  const focusedEditorId = useEventEditorValue("focus");
  const state = useFloatingToolbarState({
    editorId,
    focusedEditorId,
    floatingOptions: FLOATING_OPTIONS,
  });
  const { hidden, props, ref } = useFloatingToolbar(state);

  if (hidden) return null;

  return (
    <ToolbarSurface
      ref={ref}
      model={model}
      label={label}
      className={className}
      style={props.style}
    />
  );
}

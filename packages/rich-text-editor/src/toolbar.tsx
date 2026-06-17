import { someList, toggleBulletedList, toggleNumberedList } from "@platejs/list-classic";
import { useEditorReadOnly, useEditorRef, useEditorSelector } from "platejs/react";
import { type CSSProperties, forwardRef, type ReactNode } from "react";
import type { ToolbarControl, ToolbarModel } from "./content/capabilities.ts";

export interface RichTextToolbarProps {
  /**
   * The controls to show, already gated to what the field allows — build it
   * with `deriveToolbar(meta.elements, meta.marks)` (or `deriveMarkdownToolbar`)
   * from `@voila/rich-text-editor/content`.
   */
  model: ToolbarModel;
  /** Accessible name for the toolbar landmark. Defaults to "Formatting". */
  label?: string;
  className?: string;
  /**
   * Extra controls rendered as a final group inside the toolbar landmark — e.g.
   * an insert-image button (`RichTextImageButton`) whose action isn't a
   * turn-into/mark/list control derivable from the field's `elements`.
   */
  extra?: ReactNode;
}

/**
 * A fixed formatting toolbar for {@link RichTextEditor}. Render it as the
 * editor's `toolbar` prop so it sits inside the Plate provider and can drive the
 * editor. It is presentation-light (unstyled buttons + `voila-rich-text-toolbar`
 * classes in `styles.css`) and capability-driven: it shows exactly the controls
 * in `model`, each reflecting and toggling the current selection.
 */
export function RichTextToolbar({
  model,
  label = "Formatting",
  className = "voila-rich-text-toolbar",
  extra,
}: RichTextToolbarProps) {
  return <ToolbarSurface model={model} label={label} className={className} extra={extra} />;
}

export interface ToolbarSurfaceProps {
  model: ToolbarModel;
  label: string;
  className: string;
  /** Positioning style, e.g. from a floating-UI hook. Spread onto the landmark. */
  style?: CSSProperties;
  /** Extra controls rendered as a final group (see {@link RichTextToolbarProps.extra}). */
  extra?: ReactNode;
}

/**
 * The shared `role="toolbar"` landmark: the block / mark / list control groups,
 * each button reflecting and toggling the current selection. Both the fixed
 * {@link RichTextToolbar} and the floating toolbar render through this so the
 * controls and a11y stay identical — only the chrome (class + positioning)
 * differs. Returns `null` for an empty model so callers needn't pre-check.
 *
 * `ref` forwards to the landmark element so a floating-UI hook can measure and
 * position it.
 */
export const ToolbarSurface = forwardRef<HTMLDivElement, ToolbarSurfaceProps>(
  function ToolbarSurface({ model, label, className, style, extra }, ref) {
    const { blocks, marks, lists } = model;
    if (blocks.length === 0 && marks.length === 0 && lists.length === 0 && !extra) return null;

    return (
      <div
        ref={ref}
        role="toolbar"
        aria-label={label}
        aria-orientation="horizontal"
        className={className}
        style={style}
      >
        <ToolbarGroup controls={blocks} />
        <ToolbarGroup controls={marks} />
        <ToolbarGroup controls={lists} />
        {extra ? <div className="voila-rich-text-toolbar-group">{extra}</div> : null}
      </div>
    );
  },
);

function ToolbarGroup({ controls }: { controls: ReadonlyArray<ToolbarControl> }): ReactNode {
  if (controls.length === 0) return null;
  return (
    <div className="voila-rich-text-toolbar-group">
      {controls.map((control) => (
        <ToolbarButton key={`${control.control}:${control.wireType}`} control={control} />
      ))}
    </div>
  );
}

/** Reads whether `control` is active for the current selection (reactively). */
function useControlActive(control: ToolbarControl): boolean {
  return useEditorSelector(
    (editor) => {
      switch (control.control) {
        case "mark":
          return editor.api.hasMark(control.plateKey);
        case "list":
          return someList(editor, control.plateKey);
        default:
          return editor.api.block()?.[0]?.type === control.plateKey;
      }
    },
    [control.control, control.plateKey],
  );
}

function ToolbarButton({ control }: { control: ToolbarControl }): ReactNode {
  const editor = useEditorRef();
  const readOnly = useEditorReadOnly();
  const active = useControlActive(control);

  function apply() {
    switch (control.control) {
      case "mark":
        editor.tf.toggleMark(control.plateKey);
        break;
      case "list":
        if (control.plateKey === "ol") toggleNumberedList(editor);
        else toggleBulletedList(editor);
        break;
      default:
        editor.tf.toggleBlock(control.plateKey);
        break;
    }
  }

  return (
    <button
      type="button"
      className="voila-rich-text-toolbar-button"
      aria-label={control.label}
      title={control.label}
      aria-pressed={active}
      data-active={active || undefined}
      disabled={readOnly}
      // Keep the editor selection on press (a plain click would blur it first).
      onMouseDown={(event) => {
        event.preventDefault();
        if (!readOnly) {
          editor.tf.focus();
          apply();
        }
      }}
    >
      {control.label}
    </button>
  );
}

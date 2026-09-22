// PreviewToggle — the header button that shows or hides the live preview
// pane beside a document. It only exists when the collection has a preview
// target and the viewport can hold the split; the choice is remembered per
// slug (`usePreviewToggle`).

import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { Button } from "@voila.dev/ui/button";
import type { ReactNode } from "react";

export interface PreviewToggleProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function PreviewToggle({ open, onOpenChange }: PreviewToggleProps): ReactNode {
  const label = open ? "Hide preview" : "Show preview";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      data-slot="preview-toggle"
      aria-pressed={open}
      aria-label={label}
      title={label}
      onClick={() => onOpenChange(!open)}
    >
      {open ? <EyeSlashIcon aria-hidden /> : <EyeIcon aria-hidden />}
    </Button>
  );
}

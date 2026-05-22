import { cn } from "@voila/ui";
import { CheckIcon, CopyIcon } from "@voila/ui/icons";
import { useCallback, useEffect, useState } from "react";

export function CopyCommand({ command, className }: { command: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    if (typeof navigator === "undefined") return;
    navigator.clipboard
      ?.writeText(command)
      .then(() => setCopied(true))
      .catch(() => undefined);
  }, [command]);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-border bg-card/80 px-4 py-3 font-mono text-sm shadow-sm backdrop-blur",
        className,
      )}
    >
      <span aria-hidden="true" className="select-none text-primary">
        $
      </span>
      <code className="flex-1 truncate text-foreground">{command}</code>
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? "Copied" : "Copy command"}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background/80 text-muted-foreground transition-colors hover:text-foreground"
      >
        {copied ? (
          <CheckIcon className="h-3.5 w-3.5 text-accent" />
        ) : (
          <CopyIcon className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

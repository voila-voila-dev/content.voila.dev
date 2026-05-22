import { cn } from "@voila/ui";

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-sm font-semibold tracking-tight",
        className,
      )}
    >
      <LogoMark className="h-6 w-6" />
      <span className="text-foreground">
        content<span className="text-muted-foreground">.voila.dev</span>
      </span>
    </span>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <title>content.voila.dev mark</title>
      <defs>
        <linearGradient
          id="voila-mark"
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="hsl(265 90% 68%)" />
          <stop offset="1" stopColor="hsl(188 95% 55%)" />
        </linearGradient>
      </defs>
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="7.5"
        stroke="url(#voila-mark)"
        strokeWidth="1.5"
      />
      <path
        d="M9 11l4.6 11a1 1 0 0 0 1.85.02L20 11"
        stroke="url(#voila-mark)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23" cy="11.5" r="1.5" fill="url(#voila-mark)" />
    </svg>
  );
}

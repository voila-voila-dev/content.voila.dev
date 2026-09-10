// The site's small vocabulary of printed-programme parts: a wide-tracked
// eyebrow, hairline rules, an outlined badge, a metadata line of bullet-joined
// facts, and the poster block that stands in for artwork the cinema hasn't
// uploaded. Everything else is composed from these plus raw layout.

import { type CSSProperties, type ReactNode, useState } from "react";

export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <p className={`text-[0.68rem] font-medium uppercase tracking-[0.22em] text-faint ${className}`}>
      {children}
    </p>
  );
}

/** A section opener: the rule, the eyebrow, and an optional trailing link. */
export function SectionHead({
  label,
  action,
}: {
  label: ReactNode;
  action?: ReactNode;
}): ReactNode {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-rule pt-4">
      <Eyebrow>{label}</Eyebrow>
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "muted";
}): ReactNode {
  const tones = {
    default: "border-rule-strong text-dim",
    accent: "border-(--accent) text-(--accent)",
    muted: "border-rule text-faint",
  } as const;
  return (
    <span
      className={`inline-block border px-2 py-[0.15rem] text-[0.62rem] font-medium uppercase tracking-[0.16em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Facts joined by a hairline bullet: `1958 · 128 min · United States`. */
export function MetaLine({
  items,
  className = "",
}: {
  items: ReadonlyArray<string | null | undefined>;
  className?: string;
}): ReactNode {
  const kept = items.filter((item): item is string => typeof item === "string" && item !== "");
  if (kept.length === 0) return null;
  return (
    <p className={`text-sm text-dim ${className}`}>
      {kept.map((item, index) => (
        <span key={item}>
          {index > 0 ? <span className="text-faint"> · </span> : null}
          {item}
        </span>
      ))}
    </p>
  );
}

/**
 * A film's artwork slot. When the CMS has a poster we show it; when it doesn't —
 * or when the file behind the URL has gone (a media record whose object was
 * deleted, a private bucket, an offline CDN) — the film's own `accentColor`
 * becomes a solid ground with the title set in the display face. A placeholder
 * that still looks like a poster, and that an editor can restyle by picking a
 * different colour. A broken-image glyph never appears.
 */
export function Poster({
  title,
  year,
  image,
  color,
  ratio = "2 / 3",
}: {
  title: string;
  year?: number | null;
  image?: string | null;
  color?: string | null;
  ratio?: string;
}): ReactNode {
  const [broken, setBroken] = useState(false);
  const style = { aspectRatio: ratio } as CSSProperties;
  if (image && !broken) {
    return (
      <div className="w-full max-w-full overflow-hidden border border-rule bg-raised" style={style}>
        <img
          src={image}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      </div>
    );
  }
  const ground = color ?? "var(--color-raised)";
  return (
    <div
      className="flex w-full max-w-full flex-col justify-end overflow-hidden border border-rule p-4"
      style={{ ...style, backgroundColor: ground }}
      aria-hidden="true"
    >
      <span
        className="font-display text-[clamp(1.1rem,2.1vw,1.7rem)] leading-[1.05] text-black/85 mix-blend-hard-light"
        style={{ hyphens: "auto" }}
      >
        {title}
      </span>
      {year ? (
        <span className="mt-2 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-black/60">
          {year}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A wide image (a film's still, a journal cover) that simply removes itself when
 * the file can't be fetched — a banner slot is decorative, so a missing object
 * should leave no trace rather than a broken frame.
 */
export function Banner({
  image,
  ratio,
  color,
}: {
  image: string;
  ratio: string;
  color?: string | null;
}): ReactNode {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    <div
      className="w-full max-w-full overflow-hidden border border-rule"
      style={
        { aspectRatio: ratio, backgroundColor: color ?? "var(--color-raised)" } as CSSProperties
      }
    >
      <img
        src={image}
        alt=""
        className="h-full w-full object-cover"
        onError={() => setBroken(true)}
      />
    </div>
  );
}

/** The empty state: never a shrug, always a sentence in the cinema's voice. */
export function Empty({ children }: { children: ReactNode }): ReactNode {
  return (
    <p className="border-t border-rule py-10 font-display text-xl italic text-faint">{children}</p>
  );
}

/** The page opener every route above the fold shares. */
export function PageHeader({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
}): ReactNode {
  return (
    <header className="border-b border-rule pb-8 pt-10 sm:pt-14">
      {eyebrow ? <Eyebrow className="mb-4">{eyebrow}</Eyebrow> : null}
      <h1 className="font-display text-[clamp(2.4rem,7vw,4.5rem)] font-medium leading-[0.95]">
        {title}
      </h1>
      {lead ? <p className="mt-5 max-w-2xl text-base leading-relaxed text-dim">{lead}</p> : null}
    </header>
  );
}

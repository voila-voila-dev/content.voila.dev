// Resolve a branding `logo` to a renderable node. The config accepts either a
// ready-made node or a string `src` (an SVG/PNG URL or data URI) for the common
// "just point at my logo file" case — the string becomes a small `<img>`. The
// mark is decorative (`alt=""`): the config's `branding.name` sits beside it and
// already labels the header.
//
// The `fallbackSrc` is the logo the editors uploaded into the settings singleton
// (`theme.logoFrom`). It sits *behind* `defineAdmin`'s own logo — a site that
// ships a mark in config keeps it — and in front of the initial-letter mark the
// sidebar and login page draw when neither is set.

import type { ReactNode } from "react";
import type { AdminBranding } from "../types";

export function resolveBrandLogo(logo: AdminBranding["logo"], fallbackSrc?: string): ReactNode {
  const resolved = logo ?? fallbackSrc;
  if (resolved == null) return null;
  if (typeof resolved === "string") {
    return <img src={resolved} alt="" className="h-6 w-auto" />;
  }
  return resolved;
}

// Resolve a branding `logo` to a renderable node. The config accepts either a
// ready-made node or a string `src` (an SVG/PNG URL or data URI) for the common
// "just point at my logo file" case — the string becomes a small `<img>`. The
// mark is decorative (`alt=""`): the config's `branding.name` sits beside it and
// already labels the header.

import type { ReactNode } from "react";
import type { AdminBranding } from "../types";

export function resolveBrandLogo(logo: AdminBranding["logo"]): ReactNode {
  if (logo == null) return null;
  if (typeof logo === "string") {
    return <img src={logo} alt="" className="h-6 w-auto" />;
  }
  return logo;
}

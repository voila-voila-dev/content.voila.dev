// Path matcher for config-registered custom screens. The catch-all admin route
// (`admin.$.tsx`) hands its splat to this; the matched screen's component +
// loader then render inside the already-mounted guard + shell. This is what lets
// a host "add a screen" by adding a config object instead of a route file.
//
// Supports literal segments and `:param` captures. When several patterns match,
// the most specific wins (fewest param segments), so `/posts/featured` beats
// `/posts/:id` — mirroring TanStack's static-over-dynamic ranking.

export interface ScreenMatch<S> {
  readonly screen: S;
  readonly params: Readonly<Record<string, string>>;
}

/** Normalize to `seg/seg` with no leading/trailing slashes. `""` → `[]`. */
function segments(path: string): string[] {
  return path.split("/").filter((s) => s.length > 0);
}

// Try one pattern against one path. Returns captured params, or null if no match.
function matchPattern(pattern: string[], path: string[]): Record<string, string> | null {
  if (pattern.length !== path.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i] as string;
    const v = path[i] as string;
    if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(v);
    else if (p !== v) return null;
  }
  return params;
}

/**
 * Find the screen whose `path` matches `pathname` (the portion under the admin
 * base path). Returns the screen + captured params, or `null` when none match.
 */
export function matchScreen<S extends { readonly path: string }>(
  screens: ReadonlyArray<S>,
  pathname: string,
): ScreenMatch<S> | null {
  const path = segments(pathname);
  let best: ScreenMatch<S> | null = null;
  let bestParamCount = Number.POSITIVE_INFINITY;

  for (const screen of screens) {
    const pattern = segments(screen.path);
    const params = matchPattern(pattern, path);
    if (params === null) continue;
    const paramCount = Object.keys(params).length;
    if (paramCount < bestParamCount) {
      best = { screen, params };
      bestParamCount = paramCount;
    }
  }
  return best;
}

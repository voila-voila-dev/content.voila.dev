// A link to a config-derived path. TanStack's `<Link to>` is typed against the
// consuming app's registered route tree, which a generic admin can't satisfy for
// paths built at runtime (`/${slug}/${id}`). So this renders a real anchor and
// navigates client-side through the *typed* `router.navigate({ href })` escape —
// no route-literal cast, correct middle/modifier-click behavior, works under any
// `basePath`. Used everywhere the screens link to a dynamic path (and as the
// `renderLink` for the sidebar + dashboard).

import { useRouter } from "@tanstack/react-router";
import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from "react";

export interface AdminLinkProps extends ComponentPropsWithoutRef<"a"> {
  readonly href: string;
  readonly children?: ReactNode;
}

function isModifiedEvent(e: MouseEvent): boolean {
  return e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
}

export function AdminLink({ href, onClick, ...rest }: AdminLinkProps): ReactNode {
  const router = useRouter();
  return (
    <a
      href={href}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        // Let the browser handle modified clicks (open-in-new-tab) and any
        // handler that already opted out.
        if (e.defaultPrevented || isModifiedEvent(e)) return;
        e.preventDefault();
        void router.navigate({ href });
      }}
      {...rest}
    />
  );
}

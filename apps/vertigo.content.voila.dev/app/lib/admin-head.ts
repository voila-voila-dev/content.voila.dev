// The `<head>` contribution every admin route makes: the admin's own stylesheet
// (kept apart from the public site's — see `app/admin.css`), maplibre's for the
// map view, and the title/favicon/accent-token block built from `admin.branding`
// plus the brand the editors own.
//
// It lives here rather than on one admin route because the login page sits
// OUTSIDE the `/admin` guard layout (`admin_.login.tsx`), so it can't inherit a
// head from it and still needs the same chrome.

import type { AdminBrandSource } from "@voila/content-admin";
import { brandingHead } from "@voila/content-admin";
import maplibreCss from "maplibre-gl/dist/maplibre-gl.css?url";
import adminCss from "../admin.css?url";
import { admin } from "./admin";

// A projector beam on a light ground — the public site's mark, inverted, so the
// admin tab is recognisably the same house.
const FAVICON =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2032%2032'%3E%3Crect%20width='32'%20height='32'%20rx='7'%20fill='%230b0a09'/%3E%3Cpath%20d='M9%2016l14-7v14z'%20fill='%23d64933'/%3E%3C/svg%3E";

export function adminHead(brand?: AdminBrandSource) {
  const chrome = brandingHead(admin.branding, {
    defaultFavicon: FAVICON,
    theme: admin.theme,
    brand,
  });
  return {
    meta: [...chrome.meta],
    links: [
      { rel: "stylesheet", href: adminCss },
      { rel: "stylesheet", href: maplibreCss },
      ...chrome.links,
    ],
    styles: [...chrome.styles],
  };
}

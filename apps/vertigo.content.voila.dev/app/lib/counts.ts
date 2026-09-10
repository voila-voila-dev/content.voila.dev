// `fetchCounts` resolves the per-collection document count server-side so the
// dashboard renders real numbers in the SSR HTML — no client fetch waterfall.
//
// Unlike the demo's version, this counts the site's own D1 through
// `runtime.database`: there is no Durable Object here, the admin and the public
// pages read and write one database.

import { createServerFn } from "@tanstack/react-start";
import { countDocuments } from "@voila/content-admin/server";
import config from "../../content.config";
import { runtime } from "./server";

export const fetchCounts = createServerFn({ method: "GET" }).handler(() =>
  countDocuments(config, runtime.database),
);

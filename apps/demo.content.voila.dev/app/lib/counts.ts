// `fetchCounts` resolves the per-collection document count server-side so the
// dashboard renders real numbers in the SSR HTML — no client fetch waterfall.
// Wrapped in `createServerFn` so the server-only `./server` import never reaches
// the client bundle.

import { createServerFn } from "@tanstack/react-start";
import { countDocuments } from "@voila/content-admin/server";
import config from "../../content.config";
import { runtime } from "./server";

export const fetchCounts = createServerFn({ method: "GET" }).handler(() =>
  countDocuments(config, runtime.database),
);

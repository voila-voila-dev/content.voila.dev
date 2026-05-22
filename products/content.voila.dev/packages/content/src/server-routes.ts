import { buildHealthBody } from "./responses.tsx";

/**
 * Structurally compatible with TanStack Start's
 * `createServerFileRoute(path).methods({ GET, … })` handler signature: a
 * function taking an optional context and returning a Response.
 */
export type ServerRouteHandler = (ctx?: { request: Request }) => Response | Promise<Response>;

export const healthGET: ServerRouteHandler = () => Response.json(buildHealthBody());

// @voila/content/server — HTTP API surface (L4). M0 stubs.
//
// Full `HttpApi` definition + handlers land in M3. M0 ships:
//   - `voilaApi`: a placeholder `HttpApi` with a single `health` group so the
//     public symbol exists and consumers can `HttpApi.add(voilaApi, …)`.
//   - `makeHandler(config)`: a Fetch-compatible handler that renders the
//     branding name in a minimal HTML document — enough for the playground
//     integration smoke and the M0 acceptance test.
//   - `makeHandlerLayer` / `openApiSpec`: typed throwers, M3 targets.

import { HttpApi, HttpApiEndpoint, type HttpApiError, HttpApiGroup } from "@effect/platform";
import { Effect, Schema } from "effect";
import type { ContentConfig, ContentRuntime } from "../define.ts";

// --- voilaApi placeholder ---------------------------------------------------

const healthEndpoint: HttpApiEndpoint.HttpApiEndpoint<
  "get",
  "GET",
  never,
  never,
  never,
  never,
  { readonly ok: boolean }
> = HttpApiEndpoint.get("get", "/admin/api/health").addSuccess(
  Schema.Struct({ ok: Schema.Boolean }),
);

const healthGroup: HttpApiGroup.HttpApiGroup<"health", typeof healthEndpoint, never, never, false> =
  HttpApiGroup.make("health").add(healthEndpoint);

/**
 * Placeholder HttpApi definition. Full collection groups are derived from the
 * `ContentConfig` in M3 — until then this stub keeps the public symbol stable
 * so consumers can extend it with their own groups via `HttpApi.add`.
 */
export const voilaApi: HttpApi.HttpApi<
  "voila",
  typeof healthGroup,
  HttpApiError.HttpApiDecodeError
> = HttpApi.make("voila").add(healthGroup);

// --- makeHandler ------------------------------------------------------------

/**
 * Narrow input shape — accept either a raw `ContentConfig`, a built
 * `ContentRuntime` (the value returned by `defineContent`), or any object
 * carrying just a `branding` field (used by the M0 acceptance test). Both
 * `ContentConfig` and `ContentRuntime` expose `branding` at the top level
 * (the latter spreads the former), so resolution is a single field read.
 */
export interface BrandingOnly {
  readonly branding: { readonly name: string };
}
export type MakeHandlerInput = BrandingOnly | ContentConfig | ContentRuntime;

const resolveBranding = (input: MakeHandlerInput): { readonly name: string } =>
  input.branding ?? { name: "Voila" };

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Build a Fetch-compatible handler. M0 returns a minimal HTML shell carrying
 * the branding name; real routing (CRUD endpoints, CSRF, session) ships in M3.
 */
export const makeHandler = (input: MakeHandlerInput): ((request: Request) => Promise<Response>) => {
  const branding = resolveBranding(input);
  const html = `<!doctype html><html><body><h1>${escapeHtml(branding.name)}</h1></body></html>`;
  return async (_request: Request): Promise<Response> =>
    new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
};

// --- M3 stubs ---------------------------------------------------------------

/** M3 target — see docs/pivot/packages/content.md §HTTP API. */
export const makeHandlerLayer = (_config: ContentConfig): Effect.Effect<never, never, never> =>
  Effect.die("makeHandlerLayer: not implemented in M0 (lands in M3)");

/** M3 target — derived from `voilaApi` via `OpenApi.fromApi`. */
export const openApiSpec: Effect.Effect<unknown, never, never> = Effect.die(
  "openApiSpec: not implemented in M0 (lands in M3)",
);

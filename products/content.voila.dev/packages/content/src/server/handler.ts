// `makeHandler` — the from-config mount. Hands a `Content` (from `defineContent`)
// straight to `toVoilaRpcHttpApp`, wiring the resolved `Database` and (when the
// content was defined with `auth`) the `Auth` layer for session enforcement. The
// host runs the returned `Effect` once in its long-lived scope and serves the
// `HttpApp` at `VOILA_RPC_PATH`.

import type { Auth } from "../auth/auth";
import type { NormalizedConfig } from "../config/config";
import type { Database } from "../sql/database";
import { toVoilaRpcHttpApp } from "./mount";

/** The slice of a `Content` the mount needs — structural to avoid generic variance. */
export interface HandlerInput<DE> {
  readonly config: NormalizedConfig;
  readonly database: import("effect").Layer.Layer<Database, DE, never>;
  readonly auth?: import("effect").Layer.Layer<Auth, DE, never>;
  /** CSRF signing secret (present whenever `auth` is). Enables mutation CSRF. */
  readonly secret?: string;
}

/**
 * Build the engine `HttpApp` from a composed `Content`. When `content.auth` is
 * present, every read requires a valid session; otherwise reads are public. A
 * `secret` enables HMAC double-submit CSRF on every mutation.
 */
export const makeHandler = <DE>(content: HandlerInput<DE>) =>
  toVoilaRpcHttpApp(content.config, {
    database: content.database,
    auth: content.auth,
    secret: content.secret,
  });

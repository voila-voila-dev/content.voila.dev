// Server-side wiring: SQLite database, the magic-link authenticator, and the
// voila REST handler mounted at /admin/api. Imported only from server route
// handlers. `vite dev` runs SSR under Node, so the database opens through the
// `node:sqlite` driver — the same `local.db` the CLI migrates under Bun.

import {
  consoleMailer,
  firstUserAccess,
  makeBetterAuth,
  resendMailer,
} from "@voila/content/better-auth";
import { createRestHandler, makeDatabase } from "@voila/content/server";
import { makeNodeSqliteDriver } from "@voila/content/server/node-sqlite";
import config from "../../content.config";

// Load `.env` into process.env (Node ≥ 20.12) so `vite dev` sees the secret.
try {
  process.loadEnvFile();
} catch {
  // No .env file; rely on the ambient environment.
}

const secret = process.env.VOILA_AUTH_SECRET;
if (!secret) {
  throw new Error(
    "VOILA_AUTH_SECRET is not set. Copy .env.example to .env or set the variable — it signs " +
      "auth sessions, magic-link tokens, and the CSRF token.",
  );
}
const baseUrl = process.env.VOILA_BASE_URL ?? "http://localhost:3000";

const driver = makeNodeSqliteDriver({
  url: new URL("../../local.db", import.meta.url).pathname,
});
const database = makeDatabase(config, driver);

const mailer =
  process.env.RESEND_API_KEY && process.env.VOILA_AUTH_FROM
    ? resendMailer({ apiKey: process.env.RESEND_API_KEY, from: process.env.VOILA_AUTH_FROM })
    : consoleMailer();

/** The Better Auth bridge: its `handler` serves the auth routes (sign-in,
 *  verify, sign-out) and its `authenticator` resolves the session for the API. */
export const auth = makeBetterAuth({ secret, driver, mailer, baseUrl });

/** The secret, re-exported so the API route reuses it to mint CSRF tokens. */
export const authSecret = secret;

// Secure by default: a valid session (`auth`), a CSRF token on writes (`csrf`),
// and the admin (the first account to sign in, `access`).
export const restHandler = createRestHandler(
  { config, database },
  {
    basePath: "/admin/api",
    auth: auth.authenticator,
    csrf: { secret },
    access: firstUserAccess(driver),
  },
);

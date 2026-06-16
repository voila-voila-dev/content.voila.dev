// Server-side wiring: the local SQLite database, the magic-link authenticator,
// and the voila REST handler the typed client talks to — all mounted at
// /admin/api. Imported only from server route handlers, never from client code.

import {
  consoleMailer,
  firstUserAccess,
  makeBetterAuth,
  resendMailer,
} from "@voila/content/better-auth";
import { createRestHandler, makeDatabase } from "@voila/content/server";
// `vite dev` runs SSR under Node, so the app opens the database with the
// node:sqlite driver; `voila migrate apply` (which runs under Bun) writes the
// same file — keep the URL in sync with your migrate target.
import { makeNodeSqliteDriver } from "@voila/content/server/node-sqlite";
import config from "../../content.config";

// Load `.env` into process.env (Node ≥ 20.12) so `vite dev` sees the secret.
// No-op if there's no .env — the real environment is used as-is.
try {
  process.loadEnvFile();
} catch {
  // No .env file; rely on the ambient environment.
}

const secret = process.env.VOILA_AUTH_SECRET;
if (!secret) {
  throw new Error(
    "VOILA_AUTH_SECRET is not set. Copy .env.example to .env (create-voila writes one for you) " +
      "or set the variable — it signs auth sessions, magic-link tokens, and the CSRF token.",
  );
}
const baseUrl = process.env.VOILA_BASE_URL ?? "http://localhost:3000";

const driver = makeNodeSqliteDriver({ url: "file:./local.db" });
const database = makeDatabase(config, driver);

// Magic links go to the terminal in dev; set RESEND_API_KEY + VOILA_AUTH_FROM
// to deliver real email.
const mailer =
  process.env.RESEND_API_KEY && process.env.VOILA_AUTH_FROM
    ? resendMailer({ apiKey: process.env.RESEND_API_KEY, from: process.env.VOILA_AUTH_FROM })
    : consoleMailer();

/** The Better Auth bridge: its `handler` serves the auth routes (sign-in,
 *  verify, sign-out) and its `authenticator` resolves the session for the API. */
export const auth = makeBetterAuth({ secret, driver, mailer, baseUrl });

/** The secret, re-exported so the session/CSRF helpers in `./auth` reuse it. */
export const authSecret = secret;

// Secure by default: every content request must carry a valid session (`auth`),
// mutating requests a valid CSRF token (`csrf`), and the caller must be the
// admin — the first account to sign in (`access`). Drop any one of these and the
// corresponding protection is off, so keep all three wired.
export const restHandler = createRestHandler(
  { config, database },
  {
    basePath: "/admin/api",
    auth: auth.authenticator,
    csrf: { secret },
    access: firstUserAccess(driver),
  },
);

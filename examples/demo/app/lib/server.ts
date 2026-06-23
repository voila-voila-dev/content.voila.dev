// Server-side runtime, built with the framework's `createAdminRuntime`. This
// demo runs on Node (`vite dev`) with the `node:sqlite` driver and filesystem
// media — the deployable scaffold uses `createWorkerAdmin` (D1 + R2) instead.
// Imported only from server route handlers and server functions.

import { consoleMailer, resendMailer } from "@voila/content/better-auth";
import { makeFsStorage } from "@voila/content/server";
import { makeNodeSqliteDriver } from "@voila/content/server/node-sqlite";
import { createAdminRuntime } from "@voila/content-admin/server";
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

const driver = makeNodeSqliteDriver({
  url: new URL("../../local.db", import.meta.url).pathname,
});

const mailer =
  process.env.RESEND_API_KEY && process.env.VOILA_AUTH_FROM
    ? resendMailer({ apiKey: process.env.RESEND_API_KEY, from: process.env.VOILA_AUTH_FROM })
    : consoleMailer();

/** The composed admin runtime: database, Better Auth bridge, REST handler. The
 *  REST mount is secure by default (auth + CSRF + first-user access control). */
export const runtime = createAdminRuntime(config, {
  driver,
  secret,
  storage: makeFsStorage({ directory: new URL("../../.voila/media", import.meta.url).pathname }),
  baseUrl: process.env.VOILA_BASE_URL,
  mailer,
});

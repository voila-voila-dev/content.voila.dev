// M1 exit E2E: magic-link login → browse the posts list → open a post detail,
// driven through a real Chromium against the worker (`wrangler dev --local` over
// local D1). The console mailer logs the magic link to the worker's stdout, which
// we grep (Resend test-mode can't be read back from a test process).
//
// Opt-in: `E2E=1 bun test` — it builds the worker + boots wrangler (~slow). Uses
// the `playwright` library inside `bun:test` (not `@playwright/test`), so there
// are no Playwright `expect` matchers — assertions go through `Locator.waitFor`.

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, type Page } from "playwright";

const PORT = 8788;
const BASE = `http://localhost:${PORT}`;
const run = process.env.E2E === "1";
const suite = run ? describe : describe.skip;

const cwd = new URL("../..", import.meta.url).pathname;
let server: ChildProcess;
let browser: Browser;
let page: Page;
let serverOut = "";

const sh = (cmd: string, args: string[]) =>
  spawnSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const waitFor = async (predicate: () => boolean, timeoutMs: number, label: string) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    `timed out waiting for ${label}\n--- server output ---\n${serverOut.slice(-2000)}`,
  );
};

beforeAll(async () => {
  if (!run) return; // skip the heavy setup unless E2E=1
  // 1) Build the worker and provision the local D1 (idempotent).
  const build = sh("bun", ["run", "build"]);
  if (build.status !== 0) throw new Error(`build failed:\n${build.stdout}\n${build.stderr}`);

  const setupSql = sh("bun", ["scripts/gen-setup-sql.ts"]).stdout;
  const sqlFile = join(mkdtempSync(join(tmpdir(), "voila-e2e-")), "setup.sql");
  writeFileSync(sqlFile, setupSql);
  const seed = sh("bunx", [
    "wrangler",
    "d1",
    "execute",
    "DATABASE",
    "--local",
    `--file=${sqlFile}`,
    "--yes",
  ]);
  if (seed.status !== 0) throw new Error(`d1 setup failed:\n${seed.stdout}\n${seed.stderr}`);

  // 2) Boot the worker; capture stdout so we can grep the magic link.
  server = spawn("bunx", ["wrangler", "dev", "--port", String(PORT), "--local"], { cwd });
  server.stdout?.on("data", (d) => {
    serverOut += String(d);
  });
  server.stderr?.on("data", (d) => {
    serverOut += String(d);
  });
  await waitFor(() => serverOut.includes(`Ready on`), 90_000, "wrangler ready");

  browser = await chromium.launch();
  page = await browser.newPage();
}, 180_000);

afterAll(async () => {
  await browser?.close();
  server?.kill("SIGTERM");
});

suite("admin: magic-link login → browse → detail", () => {
  it("logs in, lists posts, and opens a post", async () => {
    // Unauthenticated /admin redirects to /login.
    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("email-input").waitFor({ state: "visible", timeout: 20_000 });

    // Request a magic link.
    const before = serverOut.length;
    await page.getByTestId("email-input").fill("admin@acme.com");
    await page.getByRole("button", { name: /send magic link/i }).click();
    await page.getByTestId("magic-link-sent").waitFor({ state: "visible", timeout: 20_000 });

    // Grep the freshly-logged verify URL and follow it (sets the session cookie).
    let link = "";
    await waitFor(
      () => {
        const match = serverOut
          .slice(before)
          .match(/https?:\/\/localhost:\d+\/admin\/api\/auth\/magic-link\/verify\?[^\s"]+/);
        if (match) link = match[0];
        return link !== "";
      },
      15_000,
      "magic link in server log",
    );

    await page.goto(link, { waitUntil: "domcontentloaded" });

    // Now authenticated: browse the posts collection.
    await page.getByRole("link", { name: "Posts" }).first().click();
    await page.getByText("Hello world").first().waitFor({ state: "visible", timeout: 20_000 });
    expect(page.url()).toContain("/admin/posts");

    // Open the detail view.
    await page
      .getByRole("link", { name: /post_seed_1/ })
      .first()
      .click();
    await page.getByText("Hello world").first().waitFor({ state: "visible", timeout: 20_000 });
    expect(page.url()).toContain("/admin/posts/post_seed_1");
  }, 120_000);

  // Reuses the session established above (`page` stays authenticated). Exercises the
  // full write path through the form + the CSRF-armed write client (mint → header →
  // mutation). Verification points use full reloads because mutations don't yet
  // invalidate the cached read atoms (optimistic updates are a later M2 item).
  it("creates, edits, and deletes a post through the form", async () => {
    const title = `E2E Post ${Date.now()}`;
    const edited = `${title} (edited)`;

    // Create.
    await page.goto(`${BASE}/admin/posts/new`, { waitUntil: "domcontentloaded" });
    await page.locator("#field-title").waitFor({ state: "visible", timeout: 20_000 });
    await page.locator("#field-title").fill(title);
    await page.getByRole("button", { name: /^create$/i }).click();

    // Lands on the new document's detail (a generated id, not "new").
    await page.waitForURL(/\/admin\/posts\/(?!new$)[^/]+$/, { timeout: 20_000 });
    const detailUrl = page.url();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText(title).first().waitFor({ state: "visible", timeout: 20_000 });

    // Edit.
    await page.goto(`${detailUrl}/edit`, { waitUntil: "domcontentloaded" });
    await page.locator("#field-title").waitFor({ state: "visible", timeout: 20_000 });
    await page.locator("#field-title").fill(edited);
    await page.getByRole("button", { name: /save changes/i }).click();
    await page.waitForURL((url) => url.pathname === new URL(detailUrl).pathname, {
      timeout: 20_000,
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText(edited).first().waitFor({ state: "visible", timeout: 20_000 });

    // Delete (accept the confirm dialog), returning to the list.
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByTestId("delete-button").click();
    await page.waitForURL(/\/admin\/posts\/?$/, { timeout: 20_000 });

    // The document is gone: reloading its detail shows the not-found state.
    await page.goto(detailUrl, { waitUntil: "domcontentloaded" });
    await page
      .getByText(/not found/i)
      .first()
      .waitFor({ state: "visible", timeout: 20_000 });
  }, 120_000);
});

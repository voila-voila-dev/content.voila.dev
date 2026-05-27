/**
 * M1 testing-bar E2E — drives a real Chromium against `bun dev` for the
 * playground. Validates the read path end-to-end: magic-link sign-in, the
 * `posts` collection list, and the detail view.
 *
 * Skipped by default so `bun test` from the repo root stays fast. Run with:
 *
 *   E2E=1 bun test products/content.voila.dev/apps/playground.content.voila.dev/test/e2e
 *
 * The test owns the full lifecycle: it seeds the local D1 (admin user + posts),
 * spawns `vite dev` on port 8787, captures the dev-server stdout (so the
 * `consoleMailer` magic-link line is readable), runs the browser flow, and
 * tears the dev server down on exit.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { type Browser, chromium, type Page } from "playwright";

const PLAYGROUND_ROOT = resolve(import.meta.dir, "../..");
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8787";
const TEST_EMAIL = "e2e@example.com";
const READY_TIMEOUT_MS = 60_000;
const MAGIC_LINK_TIMEOUT_MS = 20_000;

const shouldRun = process.env.E2E === "1";

describe.skipIf(!shouldRun)("admin: magic-link login → posts list → detail", () => {
  let devServer: ReturnType<typeof Bun.spawn> | undefined;
  // Rolling buffer of dev-server stdout. We grep this for the consoleMailer
  // line — keeping it in-memory beats tailing a file from a separate process.
  let serverLog = "";
  let browser: Browser | undefined;
  let page: Page | undefined;

  beforeAll(async () => {
    // Seed first. Re-applying migrations is idempotent (D1 tracks them), and
    // the seed inserts use INSERT OR IGNORE / upsert so re-runs are safe.
    runVoila(["migrate", "apply", "--target", "d1-local", "--binding", "DATABASE"]);
    runVoila([
      "seed",
      "admin",
      "--email",
      TEST_EMAIL,
      "--target",
      "d1-local",
      "--binding",
      "DATABASE",
    ]);
    runSeedPosts();

    // Only spawn the dev server when the caller hasn't pointed E2E_BASE_URL at
    // an externally-running one. Useful for debugging — leave `bun dev` open in
    // a terminal and re-run the test without paying the 10s boot cost.
    if (!process.env.E2E_BASE_URL) {
      devServer = Bun.spawn(["bun", "run", "dev"], {
        cwd: PLAYGROUND_ROOT,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, FORCE_COLOR: "0" },
      });
      void pipeInto(devServer.stdout, (chunk) => {
        serverLog += chunk;
      });
      void pipeInto(devServer.stderr, (chunk) => {
        serverLog += chunk;
      });
      await waitForServerReady(BASE_URL);
    }

    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  }, READY_TIMEOUT_MS + 30_000);

  afterAll(async () => {
    await browser?.close();
    if (devServer) {
      devServer.kill();
      await devServer.exited;
    }
  });

  test("signs in via magic link, browses posts, opens detail", async () => {
    if (!page) throw new Error("page not initialized");

    // Sign-in form. The admin layout redirects unauthenticated requests to
    // /admin/login with a `next` param — preserve that so we land on the
    // collection list after the magic-link callback.
    const beforeRequestLength = serverLog.length;
    await page.goto(`${BASE_URL}/admin/login?next=/admin/collections/posts`, {
      waitUntil: "domcontentloaded",
    });
    // Wait for hydration — the submit handler is wired through React state, so
    // a pre-hydration click would post the form natively and land on the JSON
    // response page instead of triggering the fetch() flow. Can't use
    // `networkidle` because Vite's HMR socket keeps the network busy forever.
    const emailInput = page.locator('input[name="email"]');
    await emailInput.waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement | null;
      // Hydration finished once React's event listeners replace the static
      // markup — easiest signal is the button accepting `__reactProps$…`.
      return !!btn && Object.keys(btn).some((k) => k.startsWith("__reactProps"));
    });
    await emailInput.fill(TEST_EMAIL);
    const responsePromise = page.waitForResponse((res) =>
      res.url().includes("/admin/api/auth/sign-in/magic-link"),
    );
    await page.locator('button[type="submit"]').click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    // `bun:test`'s `expect` doesn't ship Playwright matchers (`toBeVisible`),
    // so we drive the assertion via `Locator.waitFor` and treat a timeout as
    // the failure signal. Same shape for every UI assertion below.
    await page.locator("text=Magic link sent to").waitFor({ state: "visible" });

    const magicLink = await waitForMagicLink(beforeRequestLength);
    await page.goto(magicLink);
    await page.waitForURL(/\/admin\/collections\/posts(\?|$)/);

    // Posts list — the playground seed inserts "Hello world" + two others.
    // Only the `id` cell is a link; the title is plain text. Find the row
    // containing "Hello world" and click its id link to open the detail.
    await page.locator("text=Hello world").first().waitFor({ state: "visible" });
    const helloWorldRow = page.locator("tr", { hasText: "Hello world" });
    await helloWorldRow.locator('a[href*="/admin/collections/posts/"]').click();

    // Detail view is read-only in M1; the title renders inside `<h1>` via
    // `PageLayout.Title`, not as a form field.
    await page.waitForURL(/\/admin\/collections\/posts\/[A-Za-z0-9]+$/);
    await page
      .getByRole("heading", { name: "Hello world", level: 1 })
      .waitFor({ state: "visible" });
  }, 60_000);

  async function waitForMagicLink(startIndex: number): Promise<string> {
    const deadline = Date.now() + MAGIC_LINK_TIMEOUT_MS;
    // `consoleMailer` prints: `[voila/auth] magic link for {email}: {url}`.
    const pattern = /\[voila\/auth\] magic link for [^:]+: (\S+)/g;
    while (Date.now() < deadline) {
      pattern.lastIndex = 0;
      const slice = serverLog.slice(startIndex);
      let last: RegExpExecArray | null = null;
      let match: RegExpExecArray | null = pattern.exec(slice);
      while (match) {
        last = match;
        match = pattern.exec(slice);
      }
      if (last?.[1]) return last[1];
      await sleep(150);
    }
    throw new Error(
      `Timed out after ${MAGIC_LINK_TIMEOUT_MS}ms waiting for magic-link line in dev-server stdout`,
    );
  }
});

async function pipeInto(
  stream: ReadableStream<Uint8Array> | undefined,
  onChunk: (chunk: string) => void,
): Promise<void> {
  if (!stream) return;
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      onChunk(decoder.decode(value, { stream: true }));
    }
  } catch {
    // Stream closed on teardown — nothing to log.
  }
}

async function waitForServerReady(url: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/admin/api/health`);
      if (res.ok) return;
    } catch {
      // Server not yet listening — retry.
    }
    await sleep(250);
  }
  throw new Error(`Timed out after ${READY_TIMEOUT_MS}ms waiting for ${url}/admin/api/health`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function runVoila(args: string[]): void {
  const result = spawnSync("bunx", ["voila", ...args], {
    cwd: PLAYGROUND_ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`voila ${args.join(" ")} exited with status ${result.status}`);
  }
}

function runSeedPosts(): void {
  const result = spawnSync("bun", ["./scripts/seed.ts"], {
    cwd: PLAYGROUND_ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`seed posts exited with status ${result.status}`);
  }
}

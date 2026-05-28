// M0 acceptance — the thin mount produces a real Fetch response carrying the
// branding name from the user's `content.config.ts`. The test exercises
// `voilaHandler` directly via an in-memory `Request`, which is what the
// roadmap calls out as the M0 testing bar for the playground integration.
import { describe, expect, test } from "bun:test";
import { voilaHandler } from "../src/server/voila.ts";

describe("playground admin shell mount", () => {
  test("GET /admin returns 200 with branding name", async () => {
    const response = await voilaHandler(new Request("http://localhost/admin"));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("<h1>Playground</h1>");
  });
});

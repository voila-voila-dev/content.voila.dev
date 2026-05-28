import { describe, expect, test } from "bun:test";
import { makeHandler } from "./index.ts";

describe("makeHandler", () => {
  test("renders the branding name in an HTML shell", async () => {
    const handler = makeHandler({ branding: { name: "Acme" } });
    const res = await handler(new Request("http://x/admin"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("<h1>Acme</h1>");
  });

  test("HTML-escapes the branding name", async () => {
    const handler = makeHandler({ branding: { name: "<script>" } });
    const res = await handler(new Request("http://x/admin"));
    const body = await res.text();
    expect(body).toContain("&lt;script&gt;");
    expect(body).not.toContain("<script>");
  });

  test("accepts a ContentRuntime-shaped input (branding spread on top-level)", async () => {
    // `defineContent` spreads the config onto its return value so the vended
    // mount file can call `makeHandler(config)` without extra unwrapping.
    const fakeRuntime = {
      branding: { name: "FromRuntime" },
      collections: [],
      runtime: undefined as never,
      dispose: () => Promise.resolve(),
    };
    const handler = makeHandler(fakeRuntime as unknown as { branding: { name: string } });
    const res = await handler(new Request("http://x/admin"));
    const body = await res.text();
    expect(body).toContain("<h1>FromRuntime</h1>");
  });
});

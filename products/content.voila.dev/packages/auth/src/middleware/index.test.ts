import { describe, expect, test } from "bun:test";
import type { Auth } from "better-auth";
import { getSessionSafe, requireSession } from "./index.ts";

interface FakeAuthOptions {
  session?: { user: { id: string; email: string }; session: { id: string; expiresAt: Date } };
  throws?: boolean;
}

function fakeAuth(opts: FakeAuthOptions): Auth {
  return {
    api: {
      // biome-ignore lint/suspicious/noExplicitAny: minimal slice of better-auth's API for the middleware test.
      getSession: (async () => {
        if (opts.throws) throw new Error("bad cookie");
        return opts.session ?? null;
      }) as any,
    },
    // biome-ignore lint/suspicious/noExplicitAny: only `api.getSession` is exercised by requireSession.
  } as any;
}

describe("requireSession", () => {
  test("redirects to /admin/login with a next= param when no session is found", async () => {
    const guard = await requireSession(
      new Request("https://app.example.com/admin/collections/posts"),
      {
        auth: fakeAuth({}),
      },
    );
    expect(guard.kind).toBe("redirect");
    if (guard.kind === "redirect") {
      expect(guard.to.startsWith("/admin/login?next=")).toBe(true);
      expect(decodeURIComponent(guard.to.split("next=")[1] ?? "")).toBe("/admin/collections/posts");
    }
  });

  test("preserves the search string in the next= param", async () => {
    const guard = await requireSession(
      new Request("https://app.example.com/admin/collections/posts?cursor=abc"),
      { auth: fakeAuth({}) },
    );
    if (guard.kind !== "redirect") throw new Error("expected redirect");
    expect(decodeURIComponent(guard.to.split("next=")[1] ?? "")).toBe(
      "/admin/collections/posts?cursor=abc",
    );
  });

  test("allows /admin/login through without a session", async () => {
    const guard = await requireSession(new Request("https://app/admin/login"), {
      auth: fakeAuth({}),
    });
    expect(guard.kind).toBe("anonymous");
  });

  test("allows /admin/api/auth/* through without a session", async () => {
    const guard = await requireSession(
      new Request("https://app/admin/api/auth/sign-in/magic-link"),
      { auth: fakeAuth({}) },
    );
    expect(guard.kind).toBe("anonymous");
  });

  test("returns allow when a session exists", async () => {
    const session = {
      user: { id: "u1", email: "u@x" },
      session: { id: "s1", expiresAt: new Date(Date.now() + 60_000) },
    };
    const guard = await requireSession(new Request("https://app/admin"), {
      auth: fakeAuth({ session }),
    });
    expect(guard.kind).toBe("allow");
    if (guard.kind === "allow") expect(guard.session.user.id).toBe("u1");
  });

  test("treats a thrown getSession() as no session", async () => {
    const guard = await requireSession(new Request("https://app/admin/collections/posts"), {
      auth: fakeAuth({ throws: true }),
    });
    expect(guard.kind).toBe("redirect");
  });
});

describe("getSessionSafe", () => {
  const req = () => new Request("https://app/admin/api/posts");

  test("returns the session when present", async () => {
    const session = {
      user: { id: "u1", email: "u@x" },
      session: { id: "s1", expiresAt: new Date(Date.now() + 60_000) },
    };
    expect(await getSessionSafe(fakeAuth({ session }), req())).toEqual(session);
  });

  test("returns null when there's no session", async () => {
    expect(await getSessionSafe(fakeAuth({}), req())).toBeNull();
  });

  test("returns null (never throws) on a malformed cookie", async () => {
    expect(await getSessionSafe(fakeAuth({ throws: true }), req())).toBeNull();
  });
});

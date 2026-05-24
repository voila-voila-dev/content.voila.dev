"use client";

import { type FormEvent, useState } from "react";
import type { ResolvedContentConfig } from "../types.ts";

interface LoginViewProps {
  config: ResolvedContentConfig;
  /** Path the magic-link callback bounces to once the link is opened. */
  next: string;
}

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

/**
 * Email magic-link sign-in form. POSTs to the Better Auth handler via
 * `fetch` because that endpoint returns `{status: true}` JSON, not a redirect
 * — a bare `<form method="POST">` would land the user on a blank JSON page.
 *
 * Server-side renders the idle form so the markup is identical on first paint;
 * `useState` only flips after a real submit, so SSR + hydration line up.
 */
export function LoginView({ config, next }: LoginViewProps) {
  const brand = config.branding.name ?? "Voila";
  const Logo = config.branding.logo;
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    if (!email) return;
    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/admin/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, callbackURL: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setStatus({ kind: "error", message: body?.message ?? `Sign-in failed (${res.status}).` });
        return;
      }
      setStatus({ kind: "sent", email });
    } catch (cause) {
      setStatus({
        kind: "error",
        message: cause instanceof Error ? cause.message : "Network error.",
      });
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          {Logo ? <Logo className="size-10" /> : null}
          <h1 className="font-semibold text-xl">Sign in to {brand}</h1>
          <p className="text-muted-foreground text-sm">
            We'll email you a magic link. No password required.
          </p>
        </div>

        {status.kind === "sent" ? (
          <p className="rounded-md border border-green-200 bg-green-50 p-3 text-green-900 text-sm">
            Magic link sent to <strong>{status.email}</strong>. The link expires in 5 minutes.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block space-y-1">
              <span className="font-medium text-sm">Email</span>
              <input
                type="email"
                name="email"
                required
                disabled={status.kind === "submitting"}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                placeholder="you@example.com"
              />
            </label>
            <button
              type="submit"
              disabled={status.kind === "submitting"}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 font-medium text-primary-foreground text-sm shadow-sm hover:bg-primary/90 disabled:opacity-60"
            >
              {status.kind === "submitting" ? "Sending…" : "Email me a magic link"}
            </button>
            {status.kind === "error" ? (
              <p className="text-red-600 text-sm">{status.message}</p>
            ) : null}
          </form>
        )}
      </div>
    </div>
  );
}

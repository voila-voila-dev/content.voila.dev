// The magic-link login screen. Mounted by the host's `admin_.login.tsx` shim
// (un-nested from the guard so a signed-out visitor isn't bounced in a loop).
// Submitting emails a sign-in link; in dev it prints to the server console. The
// first account to sign in becomes the admin.

import { type FormEvent, type ReactNode, useState } from "react";
import { useSignIn } from "../hooks/use-auth-mutations";

export function LoginScreen(): ReactNode {
  const [email, setEmail] = useState("");
  const signIn = useSignIn();

  const sent = signIn.isSuccess;
  const pending = signIn.isPending;
  const error = signIn.error instanceof Error ? signIn.error.message : undefined;

  function submit(event: FormEvent): void {
    event.preventDefault();
    signIn.mutate(email);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          We'll email you a magic link. The first account to sign in becomes the admin.
        </p>
      </div>

      {sent ? (
        <div className="rounded-md border border-border bg-muted/40 p-4 text-sm" role="status">
          Check your inbox for a sign-in link. In development it's printed to the server terminal
          (look for <code>[voila/auth] magic link</code>).
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send magic link"}
          </button>
        </form>
      )}
    </main>
  );
}

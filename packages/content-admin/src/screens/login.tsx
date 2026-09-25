// The magic-link login screen. Mounted by the host's `login.tsx` shim
// (un-nested from the guard so a signed-out visitor isn't bounced in a loop).
// Submitting emails a sign-in link; in dev it prints to the server console. The
// first account to sign in becomes the admin (said on screen unless
// `signIn.firstAccountIsAdmin` is false, e.g. behind an allowlist). Branded from `admin.branding` +
// the config's `branding.name`, built on the kit's form primitives, with an
// explicit "check your inbox" state and an inline error state.

import { EnvelopeSimpleIcon } from "@phosphor-icons/react";
import { Button } from "@voila.dev/ui/button";
import { Card } from "@voila.dev/ui/card";
import { Input } from "@voila.dev/ui/input";
import { Label } from "@voila.dev/ui/label";
import { cn } from "@voila.dev/ui/utils";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { useAdmin } from "../context";
import { SignInError, useSignIn } from "../hooks/use-auth-mutations";
import { resolveBrandLogo } from "../lib/brand-logo";

export function LoginScreen(): ReactNode {
  const { admin, brand } = useAdmin();
  const m = admin.messages.admin;
  const [email, setEmail] = useState("");
  const signIn = useSignIn();
  const emailId = useId();

  const sent = signIn.isSuccess;
  const pending = signIn.isPending;
  const error = signIn.error instanceof Error ? signIn.error.message : undefined;
  // A non-retryable failure (this address can't sign in) shouldn't leave an
  // enabled Send button implying another try will help.
  const retryable = signIn.error instanceof SignInError ? signIn.error.retryable : true;
  const name = admin.config.branding.name;
  const logo = resolveBrandLogo(admin.branding.logo, brand?.logo);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (email.trim() === "") return;
    signIn.mutate(email.trim());
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden
            className={cn(
              "flex size-12 items-center justify-center overflow-hidden rounded-xl [&_img]:size-full [&_img]:object-cover [&_svg]:size-7",
              logo == null && "bg-primary text-primary-foreground",
            )}
          >
            {logo ?? (
              <span className="font-semibold text-lg">{name.trim().charAt(0).toUpperCase()}</span>
            )}
          </span>
          <div className="space-y-1">
            <h1 className="font-semibold text-xl">{name}</h1>
            {admin.branding.title ? (
              <p className="text-muted-foreground text-sm">{admin.branding.title}</p>
            ) : null}
          </div>
        </div>

        <Card.Root>
          <Card.Header>
            <Card.Title>{m.signInTitle}</Card.Title>
            <Card.Description>
              {m.signInDescription}
              {admin.signIn.firstAccountIsAdmin ? ` ${m.signInFirstAccount}` : null}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            {sent ? (
              <div
                role="status"
                data-slot="login-sent"
                className="flex items-start gap-3 rounded-md border bg-muted/40 p-4 text-sm"
              >
                <EnvelopeSimpleIcon
                  className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div className="space-y-1">
                  <p className="font-medium">{m.checkInbox}</p>
                  {/* Deliberately says nothing about where the link comes from.
                      A sign-in page is read by whoever is trying to get in, and
                      "check the server terminal" is an instruction only the
                      person running it locally could act on — on a deployed
                      admin it is noise at best and a leaked internal at worst. */}
                  <p className="text-muted-foreground">
                    {m.sentLinkBefore} <span className="font-medium text-foreground">{email}</span>
                    {m.sentLinkAfter}
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => signIn.reset()}
                  >
                    {m.useDifferentEmail}
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor={emailId}>{m.emailLabel}</Label>
                  <Input
                    id={emailId}
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={m.emailPlaceholder}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${emailId}-error` : undefined}
                  />
                </div>
                {error ? (
                  <p id={`${emailId}-error`} className="text-destructive text-sm" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={pending || email.trim() === "" || !retryable}
                >
                  {pending ? m.sending : m.sendMagicLink}
                </Button>
              </form>
            )}
          </Card.Content>
        </Card.Root>
      </div>
    </main>
  );
}

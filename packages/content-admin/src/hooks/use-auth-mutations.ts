// Auth mutations for the admin. `useSignIn` posts to the magic-link sign-in
// endpoint; the login screen reads `isPending` / `isSuccess` / `error` off it.
// A failure is translated to human copy (`signInFailure`) before it reaches the
// screen — the person who can't sign in should be told what to do, not shown a
// status code. The code still goes to the console for whoever is debugging.

import { useMutation } from "@tanstack/react-query";
import { useAdmin } from "../context";
import { signInFailure, signInNetworkFailure } from "../lib/sign-in-error";

/** Carries the human message plus whether retrying the same address can help. */
export class SignInError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "SignInError";
    this.retryable = retryable;
  }
}

export function useSignIn() {
  const { admin } = useAdmin();
  return useMutation({
    mutationFn: async (email: string) => {
      let res: Response;
      try {
        res = await fetch(`${admin.apiPath}/auth/sign-in/magic-link`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, callbackURL: admin.basePath || "/" }),
        });
      } catch {
        const failure = signInNetworkFailure(admin.messages.admin);
        throw new SignInError(failure.message, failure.retryable);
      }
      if (!res.ok) {
        const failure = signInFailure(res.status, admin.messages.admin);
        // The status belongs in the console, not in the person's way.
        console.warn(`[voila/auth] sign-in failed with ${res.status}`);
        throw new SignInError(failure.message, failure.retryable);
      }
    },
  });
}

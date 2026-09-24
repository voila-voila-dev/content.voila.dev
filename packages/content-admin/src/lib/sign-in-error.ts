// Human copy for a failed magic-link request.
//
// The sign-in form used to surface the raw status ("Could not send the sign-in
// link (403)."), which tells the one person who can't get in exactly nothing
// and offers no next step. Every message here names what happened and what to
// do about it, and never shows a status code — the code goes to the console for
// whoever is debugging, not to the person trying to sign in.

import { type Messages, messagesEn } from "@voila/content-ui";

type AdminMessages = Messages["admin"];

export interface SignInFailure {
  /** What went wrong, in the second person. */
  readonly message: string;
  /** Whether trying the same address again could plausibly work. */
  readonly retryable: boolean;
}

export function signInFailure(status: number, m: AdminMessages = messagesEn.admin): SignInFailure {
  switch (status) {
    case 400:
      return { message: m.signInInvalidEmail, retryable: true };
    case 401:
    case 403:
      return { message: m.signInNotAllowed, retryable: false };
    case 404:
      return { message: m.signInNoAccount, retryable: false };
    case 422:
      return { message: m.signInRejected, retryable: true };
    case 429:
      return { message: m.signInTooMany, retryable: true };
    default:
      if (status >= 500) return { message: m.signInServerError, retryable: true };
      return { message: m.signInFailed, retryable: true };
  }
}

/** The offline / DNS / CORS case, where there is no status to read. */
export function signInNetworkFailure(m: AdminMessages = messagesEn.admin): SignInFailure {
  return { message: m.signInNetwork, retryable: true };
}

/** {@link signInNetworkFailure} in English. */
export const SIGN_IN_NETWORK_FAILURE: SignInFailure = signInNetworkFailure();

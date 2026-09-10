// Human copy for a failed magic-link request.
//
// The sign-in form used to surface the raw status ("Could not send the sign-in
// link (403)."), which tells the one person who can't get in exactly nothing
// and offers no next step. Every message here names what happened and what to
// do about it, and never shows a status code — the code goes to the console for
// whoever is debugging, not to the person trying to sign in.

export interface SignInFailure {
  /** What went wrong, in the second person. */
  readonly message: string;
  /** Whether trying the same address again could plausibly work. */
  readonly retryable: boolean;
}

export function signInFailure(status: number): SignInFailure {
  switch (status) {
    case 400:
      return {
        message: "That doesn't look like a valid email address. Check it and try again.",
        retryable: true,
      };
    case 401:
    case 403:
      return {
        message:
          "This address isn't allowed to sign in. Ask an admin to invite it, or use the address you were invited with.",
        retryable: false,
      };
    case 404:
      return {
        message: "We couldn't find an account for that address.",
        retryable: false,
      };
    case 422:
      return {
        message: "That email address was rejected. Check it for typos and try again.",
        retryable: true,
      };
    case 429:
      return {
        message: "Too many attempts. Wait a minute, then request another link.",
        retryable: true,
      };
    default:
      if (status >= 500) {
        return {
          message: "Sending the link failed on our side. Try again in a moment.",
          retryable: true,
        };
      }
      return {
        message: "We couldn't send the sign-in link. Try again in a moment.",
        retryable: true,
      };
  }
}

/** The offline / DNS / CORS case, where there is no status to read. */
export const SIGN_IN_NETWORK_FAILURE: SignInFailure = {
  message: "We couldn't reach the server. Check your connection and try again.",
  retryable: true,
};

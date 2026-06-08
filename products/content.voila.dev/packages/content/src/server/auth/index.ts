// Public surface of the auth layer: the identity + RBAC seams, the CSRF
// double-submit helpers, and the request guard the REST dispatcher runs. Hosts
// implement `Authenticator`/`AccessControl`, mint tokens with `issueCsrfToken`,
// and pass the seams to `createRestHandler`.

export type { AccessControl, AccessRequest } from "./access";
export type { Authenticator } from "./authenticator";
export { readCookie } from "./cookies";
export {
  type CsrfOptions,
  DEFAULT_COOKIE_NAME,
  DEFAULT_HEADER_NAME,
  issueCsrfToken,
  verifyCsrf,
  verifyCsrfToken,
} from "./csrf";
export {
  authorizeRequest,
  type GuardOptions,
  type RouteDescriptor,
} from "./guard";
export type { Operation, Principal } from "./principal";

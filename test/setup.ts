import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Capture the runtime's native fetch classes *before* happy-dom swaps in its
// browser implementations. happy-dom enforces browser "forbidden header"
// semantics, which silently drop the `Cookie` header from a `Request` — so
// server-side handler tests (CSRF, sessions) that must build a request
// carrying a cookie reach for `globalThis.NativeRequest` instead. In the real
// worker/Bun runtime the inbound cookie is always present.
const NativeRequest = globalThis.Request;
const NativeHeaders = globalThis.Headers;

// Capture the native AbortController/AbortSignal too. happy-dom replaces them
// with browser-implementation subclasses that fail Bun's C-level identity
// check in `node:fs.readFile({ signal })` — every `@effect/platform` file
// op routes through that, so leaving happy-dom's versions globally installed
// breaks `FileSystem` under `bun test`. We re-install the natives *after*
// `GlobalRegistrator.register()` so the DOM (`document`, `window`, …) is
// still mocked, but every Node-native API that signature-checks `AbortSignal`
// keeps working.
const NativeAbortController = globalThis.AbortController;
const NativeAbortSignal = globalThis.AbortSignal;

// Capture the native `fetch`/`Response` too. happy-dom's `fetch` enforces
// browser CORS, which rejects same-process loopback requests — so server-side
// tests that serve an app on `Bun.serve` and read it back over real HTTP
// (mount/httpapi/client/atoms round-trips) hang or error. Restoring the native
// pair after `register()` keeps the DOM mocked while real HTTP works under
// `bun test`. Tests that need browser-fetch semantics can mock it locally.
const NativeFetch = globalThis.fetch;
const NativeResponse = globalThis.Response;

// happy-dom installs a `location` of `about:blank`, whose `origin`+`pathname`
// is `"null" + "blank"` = `"nullblank"` — and `@effect/platform`'s `makeUrl`
// resolves every request URL against `location.origin + location.pathname`, so
// even absolute loopback URLs fail to parse. Bun has no `location` natively
// (server runtime), so we restore that absence after `register()`.
const hadLocation = "location" in globalThis;

if (typeof window === "undefined") {
  GlobalRegistrator.register();
}

globalThis.AbortController = NativeAbortController;
globalThis.AbortSignal = NativeAbortSignal;
globalThis.fetch = NativeFetch;
globalThis.Response = NativeResponse;
// happy-dom's `Request`/`Headers` enforce browser "forbidden header" rules that
// silently drop `Cookie` — breaking the auth tests that build a request carrying
// a session cookie. DOM tests need `window`/`document`, not happy-dom's
// networking primitives, so restore the native pair globally.
globalThis.Request = NativeRequest;
globalThis.Headers = NativeHeaders;

// Drop happy-dom's `location` unless it existed natively (it doesn't in Bun).
if (!hadLocation && "location" in globalThis) {
  if (!Reflect.deleteProperty(globalThis, "location")) {
    Object.defineProperty(globalThis, "location", { value: undefined, configurable: true });
  }
}

// biome-ignore lint/suspicious/noExplicitAny: augmenting globalThis with the preserved native classes for server-side tests.
(globalThis as any).NativeRequest = NativeRequest;
// biome-ignore lint/suspicious/noExplicitAny: see above.
(globalThis as any).NativeHeaders = NativeHeaders;
// biome-ignore lint/suspicious/noExplicitAny: see above.
(globalThis as any).NativeAbortController = NativeAbortController;
// biome-ignore lint/suspicious/noExplicitAny: see above.
(globalThis as any).NativeAbortSignal = NativeAbortSignal;

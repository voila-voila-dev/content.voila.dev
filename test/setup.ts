import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Capture the runtime's native fetch classes *before* happy-dom swaps in its
// browser implementations. happy-dom enforces browser "forbidden header"
// semantics, which silently drop the `Cookie` header from a `Request` — so
// server-side handler tests (CSRF, sessions) that must build a request
// carrying a cookie reach for `globalThis.NativeRequest` instead. In the real
// worker/Bun runtime the inbound cookie is always present.
const NativeRequest = globalThis.Request;
const NativeHeaders = globalThis.Headers;

if (typeof window === "undefined") {
  GlobalRegistrator.register();
}

// biome-ignore lint/suspicious/noExplicitAny: augmenting globalThis with the preserved native classes for server-side tests.
(globalThis as any).NativeRequest = NativeRequest;
// biome-ignore lint/suspicious/noExplicitAny: see above.
(globalThis as any).NativeHeaders = NativeHeaders;

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

if (typeof window === "undefined") {
  GlobalRegistrator.register();
}

globalThis.AbortController = NativeAbortController;
globalThis.AbortSignal = NativeAbortSignal;

// biome-ignore lint/suspicious/noExplicitAny: augmenting globalThis with the preserved native classes for server-side tests.
(globalThis as any).NativeRequest = NativeRequest;
// biome-ignore lint/suspicious/noExplicitAny: see above.
(globalThis as any).NativeHeaders = NativeHeaders;
// biome-ignore lint/suspicious/noExplicitAny: see above.
(globalThis as any).NativeAbortController = NativeAbortController;
// biome-ignore lint/suspicious/noExplicitAny: see above.
(globalThis as any).NativeAbortSignal = NativeAbortSignal;

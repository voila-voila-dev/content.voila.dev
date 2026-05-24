/**
 * The on-the-wire error envelope. Mirrors `@voila/content`'s server-side
 * `ApiFailure` discriminator. We keep the contract narrow on purpose — the
 * client only depends on `code` + `message`; any structured fields the server
 * adds ride along on `details`.
 */
export interface ContentErrorEnvelope {
  error: {
    code: string;
    message?: string;
    details?: unknown;
    [k: string]: unknown;
  };
}

/**
 * Thrown by every `@voila/content-client` method when the server responds with
 * a non-2xx status (or the response cannot be decoded). `code` mirrors the
 * server's `ApiFailure` discriminator so callers branch on it without parsing
 * messages.
 */
export class ContentClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;
  readonly body: unknown;

  constructor(args: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
    body?: unknown;
  }) {
    super(args.message);
    this.name = "ContentClientError";
    this.status = args.status;
    this.code = args.code;
    this.details = args.details;
    this.body = args.body;
  }
}

/** Decode a `Response` into the success body, or throw `ContentClientError`. */
export async function unwrap<T>(res: Response): Promise<T> {
  if (res.ok) {
    return (await res.json()) as T;
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ContentClientError({
      status: res.status,
      code: "INTERNAL",
      message: `Request failed with ${res.status}`,
    });
  }
  const envelope = body as Partial<ContentErrorEnvelope>;
  const error = envelope.error;
  if (!error || typeof error.code !== "string") {
    throw new ContentClientError({
      status: res.status,
      code: "INTERNAL",
      message: `Request failed with ${res.status}`,
      body,
    });
  }
  throw new ContentClientError({
    status: res.status,
    code: error.code,
    message: typeof error.message === "string" ? error.message : error.code,
    details: error.details,
    body,
  });
}

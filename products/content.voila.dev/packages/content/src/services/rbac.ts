// @voila/content/services/rbac — RbacService Tag + default (permissive) Layer.

import { Context, Effect, Layer } from "effect";

export interface RbacSubject {
  readonly id: string;
  readonly roles?: ReadonlyArray<string>;
}

export type RbacAction = "read" | "create" | "update" | "delete" | "restore";

export interface RbacResource {
  readonly collection: string;
  readonly id?: string;
}

export interface RbacServiceShape {
  readonly can: (
    subject: RbacSubject | null,
    action: RbacAction,
    resource: RbacResource,
  ) => Effect.Effect<boolean, never>;
}

type RbacServiceBase = Context.TagClass<
  RbacService,
  "@voila/content/RbacService",
  RbacServiceShape
>;
const RbacServiceBase: RbacServiceBase = Context.Tag("@voila/content/RbacService")<
  RbacService,
  RbacServiceShape
>();
export class RbacService extends RbacServiceBase {}

/** Default permissive Layer — every check returns true. Override for real RBAC. */
export const RbacLive: Layer.Layer<RbacService> = Layer.succeed(RbacService, {
  can: () => Effect.succeed(true),
});

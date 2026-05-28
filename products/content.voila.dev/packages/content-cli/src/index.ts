// @voila/content-cli — programmatic surface for the `voila` binary.
//
// The CLI itself ships as a bin (`./src/bin/voila.ts`). This module
// re-exports the composed `cli` runner and the per-command builders so
// downstream packages (and future M0+ commands) can compose them.
//
// Design: products/content.voila.dev/docs/pivot/packages/content-cli.md
export const name: "@voila/content-cli" = "@voila/content-cli";

export { cli } from "./cli.ts";
export {
  AddError,
  addCommand,
  addProgram,
  type CopyOutcome,
  defaultRegistrySourceRoot,
  runAdd,
} from "./commands/add.ts";
export {
  type CheckResult,
  DoctorFailed,
  doctorCommand,
  doctorProgram,
  runChecks,
} from "./commands/doctor.ts";
export { listCommand, listProgram, loadManifest } from "./commands/list.ts";

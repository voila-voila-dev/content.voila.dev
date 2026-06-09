// Diffing a consumer's vended copy against the upstream registry source. Since
// `voila add` hands the app real files to own and edit, `voila diff` shows how
// far a local copy has drifted: whether each target is unchanged, modified, or
// missing, and — for modified files — a line-level diff (upstream vs. local).
// The diff is a plain LCS over lines, kept pure so it's exhaustively testable;
// the filesystem read is the only side effect, isolated in `diffFiles`.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { readItemFile } from "./files";
import { fileTarget, type RegistryFile } from "./types";

export type FileStatus = "unchanged" | "modified" | "missing";

export interface DiffLine {
  /** `ctx` = unchanged, `del` = only upstream, `add` = only local. */
  readonly type: "ctx" | "del" | "add";
  readonly text: string;
}

export interface FileDiff {
  readonly target: string;
  readonly status: FileStatus;
  /** Line diff (upstream → local); present only when `status` is `modified`. */
  readonly hunks?: ReadonlyArray<DiffLine>;
}

/**
 * Line-level diff via a longest-common-subsequence walk. Lines only in `a`
 * (upstream) are `del`, lines only in `b` (local) are `add`, shared lines are
 * `ctx`. Deletions are preferred over additions on ties for a stable order.
 */
export function diffLines(a: string, b: string): DiffLine[] {
  const as = a.split("\n");
  const bs = b.split("\n");
  const m = as.length;
  const n = bs.length;

  // dp as a flat (m+1)×(n+1) grid; `at(i, j)` = LCS length of as[i:] and bs[j:].
  // A flat array keeps every read a `number`, sidestepping the nested-array
  // `undefined` that `noUncheckedIndexedAccess` would otherwise surface.
  const width = n + 1;
  const dp = new Array<number>((m + 1) * width).fill(0);
  const at = (i: number, j: number): number => dp[i * width + j] ?? 0;
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i * width + j] =
        as[i] === bs[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    // In-bounds reads are always strings; `?? ""` only satisfies the type.
    const ai = as[i] ?? "";
    const bj = bs[j] ?? "";
    if (ai === bj) {
      out.push({ type: "ctx", text: ai });
      i++;
      j++;
    } else if (at(i + 1, j) >= at(i, j + 1)) {
      out.push({ type: "del", text: ai });
      i++;
    } else {
      out.push({ type: "add", text: bj });
      j++;
    }
  }
  while (i < m) out.push({ type: "del", text: as[i++] ?? "" });
  while (j < n) out.push({ type: "add", text: bs[j++] ?? "" });
  return out;
}

/** Diff each file's upstream source against its on-disk copy under `cwd`. */
export async function diffFiles(
  files: ReadonlyArray<RegistryFile>,
  options: { readonly cwd: string },
): Promise<FileDiff[]> {
  const out: FileDiff[] = [];
  for (const file of files) {
    const target = fileTarget(file);
    const dest = join(options.cwd, target);
    if (!existsSync(dest)) {
      out.push({ target, status: "missing" });
      continue;
    }
    const [upstream, local] = await Promise.all([readItemFile(file), readFile(dest, "utf8")]);
    if (upstream === local) {
      out.push({ target, status: "unchanged" });
    } else {
      out.push({ target, status: "modified", hunks: diffLines(upstream, local) });
    }
  }
  return out;
}

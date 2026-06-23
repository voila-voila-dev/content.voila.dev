import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TEMPLATE_DIR } from "./scaffold";

// A scaffolded app is installed outside the workspace, so every workspace
// package the template depends on must actually be resolvable at the pinned
// range — a stale workspace version means `bun install` falls back to npm
// and 404s (see docs/dx-review.md P1).

interface Pkg {
  name?: string;
  version: string;
  private?: boolean;
  workspaces?: string[] | { packages: string[] };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

// `import.meta.dir` is `packages/create-content-voila/src`; the repo root is three
// levels up (src → create-content-voila → packages → root).
const REPO_ROOT = join(import.meta.dir, "../../..");

function readPkg(path: string): Pkg {
  return JSON.parse(readFileSync(path, "utf8"));
}

function workspacePackages(): Map<string, Pkg> {
  const { workspaces } = readPkg(join(REPO_ROOT, "package.json"));
  const patterns = Array.isArray(workspaces) ? workspaces : (workspaces?.packages ?? []);
  const packages = new Map<string, Pkg>();
  for (const pattern of patterns) {
    const glob = new Bun.Glob(`${pattern}/package.json`);
    for (const path of glob.scanSync({ cwd: REPO_ROOT })) {
      const pkg = readPkg(join(REPO_ROOT, path));
      if (pkg.name) packages.set(pkg.name, pkg);
    }
  }
  return packages;
}

describe("template dependency ranges", () => {
  const workspace = workspacePackages();
  const template = readPkg(join(TEMPLATE_DIR, "package.json"));
  const deps = { ...template.dependencies, ...template.devDependencies };
  const workspaceDeps = Object.entries(deps).flatMap(([name, range]) => {
    const pkg = workspace.get(name);
    return pkg ? [{ name, range, pkg }] : [];
  });

  test("template depends on at least one workspace package", () => {
    expect(workspaceDeps.length).toBeGreaterThan(0);
  });

  for (const { name, range, pkg } of workspaceDeps) {
    test(`${name}@${range} matches workspace version ${pkg.version}`, () => {
      expect(
        Bun.semver.satisfies(pkg.version, range),
        `template pins ${name}@${range} but the workspace has ${pkg.version} — bump one of them or bun install will 404 in a fresh scaffold`,
      ).toBe(true);
    });

    test(`${name} is publishable`, () => {
      // A private package can never reach npm, so the template's pin would
      // 404 for anyone outside this workspace.
      expect(pkg.private, `${name} is marked private but the template depends on it`).toBeFalsy();
    });
  }
});

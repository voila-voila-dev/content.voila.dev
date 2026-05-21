# @voila/ui — migration notes

## React 19 ref-as-prop (0.1)

Every primitive in this package is a plain function component and uses React 19's
ref-as-prop pattern. There is **no `React.forwardRef`** wrapper anywhere.

If you're coming from a project that still imports React 18 shadcn primitives,
the public-facing change for consumers is small but worth knowing.

### What changed

Old (React 18 idiom):

```tsx
const ref = React.useRef<HTMLButtonElement>(null);

<Button ref={ref}>Click me</Button>
```

That still works in React 19 — `ref` is just a regular prop now, and our
components forward it through to the underlying element. No code changes
required at the call site.

### What's different under the hood

The component definitions look like this instead of `React.forwardRef`:

```tsx
export function Button({ ref, className, ...props }: ButtonProps) {
  return <button ref={ref} className={cn(...)} {...props} />;
}
```

Consequences:

- **No `displayName` on most components.** React DevTools uses the function name
  directly. If you grepped for `.displayName = "Foo"` you won't find one for
  primitives anymore.
- **`ref` is part of the props type.** Prop types use `React.ComponentProps<...>`
  (which includes `ref`) rather than `React.ComponentPropsWithoutRef<...>` paired
  with a separate `ref` argument.
- **React 18 is no longer supported.** The peer range is `react@catalog:` (pinned
  to `19.0.0` at the workspace root). Apps must be on React 19+ to install this
  package — `bun install` will fail on React 18.

### asChild → `render`

shadcn's `asChild` prop (powered by Radix's `Slot`) does not exist here. Use Base
UI's `render` prop instead. This applies to components that historically accepted
`asChild` (`Button`, `BreadcrumbLink`, sidebar items, etc.):

```tsx
// Before (Radix)
<Button asChild>
  <Link to="/dashboard">Open</Link>
</Button>

// After (Base UI useRender)
<Button render={<Link to="/dashboard" />}>Open</Button>
```

The pattern is the same for any primitive that exposes `render`.

### React version pinning

React and `react-dom` (and their `@types/*`) are pinned in the root workspace
catalog:

```jsonc
// package.json
{
  "workspaces": {
    "packages": ["..."],
    "catalog": {
      "react": "19.0.0",
      "react-dom": "19.0.0"
    }
  }
}
```

Every workspace package — including `@voila/ui` — references React via
`"react": "catalog:"`. Bumping the React version is a one-line change in the
root, applied uniformly across the monorepo.

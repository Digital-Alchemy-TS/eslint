# Disallow a priorityInit entry that no sibling reads during construction (it orders nothing) (`no-unnecessary-priority-init`)

💭 This rule requires [type information](https://typescript-eslint.io/linting/typed-linting).

<!-- end auto-generated rule header -->

## What this rule enforces

A Digital-Alchemy module may declare an explicit boot order in a `priorityInit`
array. This rule requires that every entry in `priorityInit` actually earns its
place: at least one **sibling** service must read that entry's API at
construction time. An entry that no sibling construction-reads orders nothing and
is reported for removal.

"Construction time" means a read in the top-level body of a service factory (or
the object literal it returns) — code that runs while the module is wiring. A
read that happens only inside a lifecycle callback does not count, because those
callbacks run after every service has already wired, so they impose no ordering
constraint.

The rule operates on the whole program: it indexes the construction-time reads
inside each service factory, then flags any `priorityInit` entry whose service is
never construction-read by a sibling. The report lands on the offending string
element in the `priorityInit` array.

Cross-module consumption does **not** keep an entry alive. `priorityInit` can
only order services *within* one module; it cannot order across module
boundaries (that is the job of `depends:` / `libraries:`). So a service consumed
only by another module — and never construction-read by a sibling in the same
module — still has an unnecessary `priorityInit` entry.

## Why

`priorityInit` is a precise tool: it forces a producer to wire before a sibling
that reads its API during construction. Every entry should correspond to a real
construction-time dependency.

An entry that no sibling construction-reads is noise. It might be a leftover from
a one-service module, a service whose only readers live in lifecycle callbacks,
or a service consumed solely by another module. In each case the entry orders
nothing — but it reads like a meaningful boot-order constraint, misleading anyone
maintaining the module. Removing dead entries keeps `priorityInit` a faithful map
of the module's actual construction-time dependencies.

## Incorrect

```ts
// unused.module.mts
export const APP = CreateApplication({
  name: "unused_app",
  priorityInit: ["lonely"], // ❌ no sibling reads "lonely" during construction
  services: {
    lonely: LonelyService,
  },
});
```

## Correct

```ts
// good.module.mts — every priorityInit entry is construction-read by a sibling
export const APP = CreateApplication({
  name: "good_app",
  priorityInit: ["db"], // ✅ "db" is read by "api" during construction
  services: {
    api: ApiService, // reads my_app.db at construction time
    db: DbService,
  },
});
```

If a service is only ever read inside a lifecycle callback, it should not be in
`priorityInit` at all, because the callback runs after all services have wired:

```ts
// my-app.service.mts
export function ApiService({ my_app, lifecycle }: TServiceParams) {
  lifecycle.onBootstrap(() => {
    my_app.db.run(); // post-wiring read — imposes no construction-time order
  });
}
```

## When Not To Use It

This rule is intended for codebases that use the Digital-Alchemy
`CreateApplication` / `CreateLibrary` module model and treat `priorityInit` as
the single source of truth for intra-module boot order. If your project does not
use that model, the rule has nothing to match and is safe to leave disabled.

## Requires type information

This rule is type-aware: it builds a whole-program index using the TypeScript
program exposed through `parserServices`. It only runs when type information is
available — configure `parserOptions.project` (and `tsconfigRootDir` where
needed) so the parser provides a program. Without type information the rule is a
no-op and reports nothing.

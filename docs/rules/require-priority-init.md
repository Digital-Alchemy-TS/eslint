# Require a service to be listed in priorityInit when a sibling reads its API during construction (`require-priority-init`)

💭 This rule requires [type information](https://typescript-eslint.io/linting/typed-linting).

<!-- end auto-generated rule header -->

## What this rule enforces

A Digital-Alchemy module declares its services in a `services` object and may
declare an explicit boot order in a `priorityInit` array. This rule requires
that whenever one service reads a sibling service's API **at construction time**,
that sibling is listed in the module's `priorityInit` array.

"Construction time" means the read happens in the top-level body of the service
factory (or in the object literal the factory returns) — code that runs while
the module is wiring itself. A read that happens only inside a lifecycle
callback (`onBootstrap`, `onReady`, and similar) does **not** count, because
those callbacks run after every service has already been wired.

The rule operates on the whole program: it indexes every `CreateApplication` /
`CreateLibrary` declaration and the construction-time reads inside each service
factory, then reports any producer that a sibling reads but the module fails to
list. The report lands on the `priorityInit` array (or on the declaration call
itself when no `priorityInit` array exists yet).

## Why

Boot order must be expressed in exactly one place.

`priorityInit` is the single knob for intra-module boot order. The order of keys
in the `services` object is deliberately **not** treated as a second ordering
mechanism. If a service that is read during construction were allowed to rely on
its position in the `services` object to wire early enough, the boot sequence
would effectively be tuned in two separate places — the `services` order and the
`priorityInit` array. Someone reordering the `services` object for readability
would then silently break boot order, with no obvious cause.

By requiring every construction-read producer to appear in `priorityInit`, the
ordering becomes explicit and the order of the `services` object becomes
irrelevant to boot. A service absent from `priorityInit` then carries a clear,
single meaning: "this service does not participate in boot ordering at all."

This is why the rule fires **even when the producer is declared before its
consumer** in `services`. Declaration order happening to wire the producer first
is incidental, not a contract; the dependency must still be stated explicitly.

A capture such as `const db = my_app.db` counts as a construction read, because
the sibling's API object is not yet populated before that sibling has wired.

## Incorrect

```ts
// my-app.service.mts
export function ApiService({ my_app }: TServiceParams) {
  // Top-level read of sibling "db" during construction.
  my_app.db.connect();
}

export function DbService({ my_app }: TServiceParams) {
  void my_app;
}
```

```ts
// my-app.module.mts
export const MY_APP = CreateApplication({
  name: "my_app",
  priorityInit: [], // ❌ "db" is construction-read by "api" but not listed
  services: {
    api: ApiService,
    db: DbService,
  },
});
```

This still fires even if `db` is declared before `api`:

```ts
// my-app.module.mts
export const MY_APP = CreateApplication({
  name: "my_app",
  priorityInit: [], // ❌ declaration order does not exempt a construction-read producer
  services: {
    db: DbService, // declared first, but that is not a boot-order contract
    api: ApiService,
  },
});
```

## Correct

```ts
// my-app.module.mts
export const MY_APP = CreateApplication({
  name: "my_app",
  priorityInit: ["db"], // ✅ the boot-order dependency is declared explicitly
  services: {
    api: ApiService,
    db: DbService,
  },
});
```

A read that happens only inside a lifecycle callback does not require a
`priorityInit` entry, because the callback runs after all services are wired:

```ts
// my-app.service.mts
export function ApiService({ my_app, lifecycle }: TServiceParams) {
  lifecycle.onBootstrap(() => {
    my_app.db.run(); // ✅ post-wiring read, not a construction read
  });
}
```

```ts
// my-app.module.mts
export const MY_APP = CreateApplication({
  name: "my_app",
  priorityInit: [], // ✅ no construction reads, so nothing to list
  services: {
    api: ApiService,
    db: DbService,
  },
});
```

## When Not To Use It

This rule is intended for codebases that use the Digital-Alchemy
`CreateApplication` / `CreateLibrary` module model and treat `priorityInit` as
the single source of truth for boot order. If your project does not use that
model, the rule has nothing to match and is safe to leave disabled.

## Requires type information

This rule is type-aware: it builds a whole-program index using the TypeScript
program exposed through `parserServices`. It only runs when type information is
available — configure `parserOptions.project` (and `tsconfigRootDir` where
needed) so the parser provides a program. Without type information the rule is a
no-op and reports nothing.

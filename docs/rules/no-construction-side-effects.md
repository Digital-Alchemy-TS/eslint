# Disallow side-effectful statements at the root of a service factory. Construction is for wiring definitions; side effects belong in lifecycle hooks (`no-construction-side-effects`)

<!-- end auto-generated rule header -->

## What this rule enforces

In a `*.service.mts` file, the root body of the service factory function (the function that
receives `TServiceParams`) may only contain:

- Variable declarations (`const x = ...`, `let y`, function expression inits)
- Named function declarations
- A `return` statement
- `lifecycle.*` calls (e.g. `lifecycle.onPreInit(...)`, `lifecycle.onBootstrap(...)`)
- Allowlisted framework wiring calls: `http.controller(...)` and `scheduler.cron(...)`

Anything else at root — bare call expressions (`registry.register(...)`, `logger.debug(...)`),
`if` statements, loops, `try/catch` blocks, or any other control flow — is flagged.

The rule is inactive in files that do not end in `.service.mts`. Inner closures and returned
APIs are not inspected; only the immediate root statements of the factory body are checked.

## Why

A Digital-Alchemy service factory is called once per application boot to wire up the service.
Its root body is a **construction phase**: a time to define local state and register lifecycle
hooks, not to perform I/O, log messages, or evaluate conditional logic. Side effects at
construction time are executed unconditionally on every boot, cannot be retried after an error,
and execute before the framework's own lifecycle sequence has started. They are also invisible to
tests that mock lifecycle hooks and assume the factory body is pure.

The two allowlisted framework calls (`http.controller`, `scheduler.cron`) are exceptions because
they internally defer their work to a lifecycle hook; calling them at construction time is the
documented Digital-Alchemy pattern and is not a true side effect.

## Incorrect

```ts
// src/services/example.service.mts

// ❌ bare call at factory root — runs before lifecycle, not hookable
export function ExampleService({ registry, logger }: TServiceParams) {
  registry.register("KIND");
  logger.debug("registered");
  return {};
}
```

```ts
// ❌ if statement at factory root
export function MyService({ config }: TServiceParams) {
  if (config.enabled) {
    doSetup();
  }
  return {};
}
```

## Correct

```ts
// ✅ side effects moved into a lifecycle hook
export function ExampleService({ registry, logger, lifecycle }: TServiceParams) {
  lifecycle.onPreInit(() => {
    registry.register("KIND");
    logger.debug("registered");
  });
  return {};
}
```

```ts
// ✅ http.controller and scheduler.cron are allowlisted framework wiring
export function McpController({ http, kg_mcp }: TServiceParams) {
  http.controller("/mcp", (fastify) => {
    fastify.post("/", ({ body }, reply) => kg_mcp.mcp.handlePost(body, reply));
  });
}

export function PlayerService({ scheduler }: TServiceParams) {
  scheduler.cron({
    exec() { doWork(); },
    schedule: "* * * * *",
  });
  return {};
}
```

## When Not To Use It

This rule targets the Digital-Alchemy service-file convention (`*.service.mts`). If your project
uses a different naming pattern or a different lifecycle model, you can disable this rule.

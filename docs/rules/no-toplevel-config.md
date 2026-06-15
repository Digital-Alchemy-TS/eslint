# Disallow top-level config access in DA service functions (`no-toplevel-config`)

<!-- end auto-generated rule header -->

## What this rule enforces

A Digital-Alchemy service function that destructures `config` from its parameters (e.g.
`{ config, logger }: TServiceParams`) must not access `config.*` at the top level of that
function body. Config access is only permitted inside nested functions, callbacks, or arrow
functions — not as a direct statement in the service body itself.

Concise-body arrow functions (e.g. `({ config }) => config.x`) are intentionally exempt: they have
no block body, so every expression inside them is already "inside" a leaf context.

## Why

Config is read at construction time when accessed at the top level of a service. That means the
value is captured once during boot and never refreshed. More importantly, it tightly couples the
service's initialisation path to a specific config shape, making the service harder to test in
isolation and introducing fragile boot-time ordering: the config loader must have run before this
service is wired.

Accessing config inside a lifecycle callback or nested function means the value is read on demand,
after the application has fully booted, which is the intended pattern.

## Incorrect

```ts
// ❌ config accessed at the top level of a service function
function MyService({ config, logger }: TServiceParams) {
  const host = config.my_lib.HOST; // top-level access — not allowed
  return {};
}
```

```ts
// ❌ config checked in a top-level if
function MyService({ config }: TServiceParams) {
  if (config.my_lib.ENABLED) {
    return {};
  }
}
```

## Correct

```ts
// ✅ config accessed inside a lifecycle callback
function MyService({ config, lifecycle }: TServiceParams) {
  lifecycle.onReady(() => {
    const host = config.my_lib.HOST;
    logger.info(`Connecting to ${host}`);
  });
  return {};
}
```

```ts
// ✅ config accessed inside a nested helper function
function MyService({ config }: TServiceParams) {
  function getHost() {
    return config.my_lib.HOST;
  }
  return { getHost };
}
```

```ts
// ✅ concise-body arrow — exempt because there is no block body
const getter = ({ config }: TServiceParams) => config.my_lib.KEY;
```

## When Not To Use It

This rule applies to any function whose parameter destructures `config`. If your project
intentionally accesses configuration eagerly at service construction time, or does not use
the Digital-Alchemy `TServiceParams` pattern, you can disable this rule.

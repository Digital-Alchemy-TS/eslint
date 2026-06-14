# Disallow destructuring a TServiceParams member that is never used in a service (`no-unused-service-params`)

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->

## What this rule enforces

In a `*.service.mts` file, every member destructured from a `TServiceParams` parameter must be
referenced at least once (read) inside the function. A destructured member that is never used is
reported. When possible — the member is a plain `Property` and at least one other member remains —
the rule provides an autofix that removes the unused property from the destructuring pattern.

Detection uses scope analysis (`getDeclaredVariables`) so both shorthand bindings (`{ config }`)
and renamed bindings (`{ config: cfg }`) are covered.

The rule is inactive outside `*.service.mts` files and in `*.test.mts` files.

## Why

Destructuring a member from `TServiceParams` that is never referenced is not a harmless unused
variable — it is a declaration of a dependency the service does not actually have. This pollutes
the module's wiring graph with a false dependency: the framework sees the service as needing that
member, which can affect boot ordering and obscures what the service really needs. Unused
destructured members must be removed at the source.

## Incorrect

```ts
// src/services/writer.service.mts
// ❌ config is destructured but never referenced
export function WriterService({ logger, config }: TServiceParams) {
  logger.info("writing");
  return {};
}
```

## Correct

```ts
// src/services/writer.service.mts
// ✅ only the members that are actually used are destructured
export function WriterService({ logger }: TServiceParams) {
  logger.info("writing");
  return {};
}
```

Renamed bindings are treated the same way:

```ts
// ❌ cfg is never used
export function WriterService({ config: cfg, logger }: TServiceParams) {
  logger.info("writing");
  return {};
}

// ✅ remove it
export function WriterService({ logger }: TServiceParams) {
  logger.info("writing");
  return {};
}
```

## When Not To Use It

This rule is intended for codebases that use the Digital-Alchemy `TServiceParams` convention. If
your project uses a different service parameter type or deliberately destructures members for
side-effect reasons, you can disable the rule for specific lines with an inline eslint-disable
comment.

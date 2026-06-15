# Disallow a priorityInit order where a producer wires after a consumer that reads it during construction (`priority-init-order`)

💭 This rule requires [type information](https://typescript-eslint.io/linting/typed-linting).

<!-- end auto-generated rule header -->

## What this rule enforces

A Digital-Alchemy module wires its services in a fixed sequence: the
`priorityInit` entries first, in their listed order, followed by the remaining
services in `services` declaration order. This rule requires that whenever one
service reads a sibling's API **at construction time**, the sibling (the
producer) wires *before* the reader (the consumer) in that resolved sequence.

If a consumer reads a producer during construction but the resolved sequence
wires the producer *after* the consumer, the consumer reads an unwired
`undefined` — a real ordering bug. The rule reports it on the producer's
`priorityInit` element (or on the `priorityInit` array node when the producer is
not listed), so the fix — moving the producer earlier — lands where the order is
expressed.

The rule only concerns itself with producers that are actually listed in
`priorityInit`. A construction-read producer that is missing from `priorityInit`
entirely is a different problem, handled by the companion `require-priority-init`
rule; this rule handles producers that are listed but ordered too late.

Construction-read facts come from a whole-program index of every module
declaration and the construction-time reads inside each service factory.

## Why

`priorityInit` exists to guarantee that a service is ready before another service
reads it during construction. That guarantee only holds if the producer's
position in the resolved wire sequence is actually earlier than its consumer's.

When a listed producer is ordered after its consumer, the declaration *looks*
like it controls boot order, but it sequences the dependency backwards. The
consumer runs first and reads the producer's API before the producer has wired,
yielding `undefined` at construction. Requiring the producer to wire first makes
`priorityInit` mean what it appears to mean.

## Incorrect

```ts
// order.module.mts
export const APP = CreateApplication({
  name: "order_app",
  // ❌ "consumer" reads "prod" at construction, but "prod" wires after it
  priorityInit: ["consumer", "prod"],
  services: {
    consumer: ConsumerService, // reads order_app.prod during construction
    prod: ProdService,
  },
});
```

## Correct

```ts
// good.module.mts
export const APP = CreateApplication({
  name: "good_app",
  // ✅ the producer wires before the consumer that reads it
  priorityInit: ["prod", "consumer"],
  services: {
    consumer: ConsumerService, // reads good_app.prod during construction
    prod: ProdService,
  },
});
```

## When Not To Use It

This rule is intended for codebases that use the Digital-Alchemy
`CreateApplication` / `CreateLibrary` module model and rely on `priorityInit` to
sequence intra-module boot order. If your project does not use that model, the
rule has nothing to match and is safe to leave disabled.

## Requires type information

This rule is type-aware: it builds a whole-program index using the TypeScript
program exposed through `parserServices`. It only runs when type information is
available — configure `parserOptions.project` (and `tsconfigRootDir` where
needed) so the parser provides a program. Without type information the rule is a
no-op and reports nothing.

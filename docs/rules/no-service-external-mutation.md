# Disallow mutating array methods called on bindings defined outside a service factory (`no-service-external-mutation`)

<!-- end auto-generated rule header -->

## What this rule enforces

Inside a Digital-Alchemy service factory (a function that accepts `TServiceParams`), calling a
mutating array method on a binding that is defined **outside** the factory — at module scope,
imported, or global — is flagged.

The mutating methods covered are: `push`, `pop`, `shift`, `unshift`, `splice`, `sort`,
`reverse`, `fill`, `copyWithin`.

The rule is active inside factory bodies and also inside any inner function (callback, helper)
declared within the factory. Only mutations of bindings resolved outside the factory boundary
are reported; mutations of locally declared arrays are allowed.

## Why

A Digital-Alchemy service factory is called once per application boot. An array (or other
mutable collection) defined at module scope is created once and shared across every invocation
of every factory that references it. Calling a mutating method on such an array inside a factory
silently corrupts state that was intended to be shared as a read-only constant: the first boot
modifies the array and every subsequent boot sees the already-mutated version.

The correct pattern is to copy the external array locally first:

```ts
const local = [...EXTERNAL];
local.push("new item");
```

This keeps the module-scope binding pristine and ensures each factory invocation works with its
own independent copy.

## Incorrect

```ts
// ❌ pushing onto a module-scope array inside a service factory
const KNOWN_KINDS = ["a", "b"];

export function KindRegistryService({ lifecycle }: TServiceParams) {
  KNOWN_KINDS.push("c"); // mutates the shared module-scope array
}
```

```ts
// ❌ sorting a module-scope array in-place
const KEYS = ["z", "a", "m"];

export function SortedService({ lifecycle }: TServiceParams) {
  KEYS.sort(); // every invocation re-sorts the same shared array
}
```

## Correct

```ts
// ✅ copy the external array locally, mutate the copy
const KNOWN_KINDS = ["a", "b"];

export function KindRegistryService({ lifecycle }: TServiceParams) {
  const local = [...KNOWN_KINDS, "c"];
  // use local without touching KNOWN_KINDS
}
```

```ts
// ✅ mutation of a factory-local array is fine
export function SortedService({ lifecycle }: TServiceParams) {
  const keys = ["z", "a", "m"];
  keys.sort(); // local to this invocation
}
```

## When Not To Use It

This rule is specific to the Digital-Alchemy service-factory pattern. If your project does not
use `TServiceParams`-typed factory functions, you can disable this rule.

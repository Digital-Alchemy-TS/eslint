# `.service.mts` files must not declare module-scope mutable or derived state; static constants (primitive literals, static arrays/objects, `new Map/Set([...literals])`, static binary expressions, and hoistable computed expressions like `[...].join(SEP)`) are allowed at module scope per `no-service-primitive-const`. All runtime state must live in the service factory closure. Complements (does not duplicate) `no-service-primitive-const` (which targets static consts INSIDE the factory) and `service-preamble-limit` (`no-service-module-scope-state`)

<!-- end auto-generated rule header -->

## What this rule enforces

In a `*.service.mts` file, module-scope variable declarations are restricted:

- `let` and `var` declarations are **always** flagged — they are mutable by definition.
- `const` declarations whose initialiser is **not** a statically-hoistable value are flagged.

The following initialisers are considered statically hoistable (allowed at module scope):

- Primitive literals: strings, numbers, booleans, regex literals, plain template literals (no
  interpolation), negated numeric literals
- Static array literals: `["a", "b"]`, `[1, 2, 3]`
- Static object literals: `{ key: "value" }` (no computed keys, no dynamic values)
- Static `new Map([...])` / `new Set([...])` with literal seed arguments
- Static binary arithmetic expressions: `1024 * 1024`, `60 * 60 * 1000`
- Hoistable call expressions: e.g. `["a", "b"].join(MODULE_SCOPE_CONST)` — where the receiver
  and all arguments are themselves hoistable
- TypeScript `as const` / `satisfies` wrappers over any of the above (the wrapper is transparent)

Anything else — calls to functions, `new SomeClass()` with no static args, computed values,
`Date.now()`, dynamic maps/sets — is flagged.

The rule is inactive in files that do not end in `.service.mts`.

## Why

A Digital-Alchemy service factory is called once per application boot. State that lives at
module scope is created once and shared across every invocation. Mutable module-scope state
(`let`, `var`, or a `const` referencing a live object) persists between boots in hot-reload
scenarios and is invisible to tests that instantiate the factory in isolation.

All runtime state — caches, counters, maps, queues — belongs inside the factory closure, where
it is re-created fresh on each invocation. Static constants (values that never change regardless
of runtime input) may stay at module scope because they carry no mutable state.

This rule does not duplicate `no-service-primitive-const` (which targets static constants
declared *inside* the factory body that should be hoisted out) or `service-preamble-limit`
(which caps the length of the factory preamble). Together the three rules keep service files
structurally clean.

## Incorrect

```ts
// x.service.mts

// ❌ let at module scope — always mutable
let counter = 0;

// ❌ derived const — makeClient() runs at module load time
const client = makeClient();

// ❌ dynamic Map — no seed args, acts as a mutable accumulator
const cache = new Map();

// ❌ dynamic Set
export const store = new Set();
```

## Correct

```ts
// x.service.mts

// ✅ static primitive consts are fine
const FIELD_SEP = ":";
const MAX = 1024 * 1024;
const KEYS = ["a", "b"];
const SEED = new Map([["x", 1]]);

// ✅ hoistable call expression over module-scope consts
const FORMAT = ["#{id}", "#{pid}"].join(FIELD_SEP);

// ✅ all runtime state lives in the factory closure
export function MyService({ logger }: TServiceParams) {
  const cache = new Map<string, string>();
  let counter = 0;
  return { cache, getCounter: () => counter };
}
```

## When Not To Use It

This rule is specific to the Digital-Alchemy service-file convention (`*.service.mts`). If your
project uses a different naming pattern or does not follow the factory-closure state model, you
can disable this rule.

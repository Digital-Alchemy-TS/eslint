# Disallow class definitions in service files (`no-service-class`)

<!-- end auto-generated rule header -->

## What this rule enforces

Class declarations (`class Foo {}`) and class expressions (`const Foo = class {}`) are not allowed
inside `*.service.mts` files. The rule is inactive in `*.test.mts` files (test doubles may define
throwaway classes) and in any file that does not match the `*.service.mts` suffix.

## Why

Digital-Alchemy service files are factory functions, not class modules. A class definition in a
service file is a structural violation: shared types and interfaces belong in a contracts module,
and stateful constructs do not belong in the service layer at all. Keeping classes out of service
files enforces the boundary between the functional service layer and the type/helper layer, and
prevents sneaking object-oriented state management into a layer that is supposed to be a plain
factory.

## Incorrect

```ts
// src/services/writer.service.mts
// ❌ class definition in a service file
class WriterState {
  buffer: string[] = [];
}

export function WriterService({ logger }: TServiceParams) {
  return {};
}
```

## Correct

```ts
// src/contracts/writer.contracts.mts
// ✅ class or interface in a dedicated contracts/helpers module
export interface WriterState {
  buffer: string[];
}
```

```ts
// src/services/writer.service.mts
// ✅ service file contains only the factory function
import type { WriterState } from "../contracts/writer.contracts.mts";

export function WriterService({ logger }: TServiceParams) {
  return {};
}
```

## When Not To Use It

This rule is intended for codebases that use the Digital-Alchemy service-file convention
(`*.service.mts`). If your project uses class-based services or does not follow the
`*.service.mts` naming pattern, you can disable this rule.

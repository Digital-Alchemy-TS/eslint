# `.service.mts` files must not import from sibling service files. Move shared constants/types to a contracts module and share logic through the framework (dependency injection) (`no-sibling-service-import`)

<!-- end auto-generated rule header -->

## What this rule enforces

A `*.service.mts` file must not import from another `*.service.mts` file (sibling or otherwise).
The check applies to `import`, `export ... from`, and `export * from` declarations whose source
path ends in `.service.mts` or `.service.mjs`. The rule is only active in files whose own name
ends in `.service.mts`.

## Why

Services in Digital-Alchemy communicate through the framework's dependency-injection mechanism,
not through direct file-to-file imports. When one service imports another service file, it
bypasses the wiring graph: the dependency is invisible to the module, boot ordering is undefined,
and swapping one service implementation for another becomes impossible without changing both files.
Shared constants and types belong in a contracts module; shared logic belongs in a helper or in the
framework's wiring — not in a direct import.

## Incorrect

```ts
// src/foo/a.service.mts
// ❌ direct import from a sibling service file
import { SHARED_CONST } from "./b.service.mts";
```

## Correct

```ts
// src/contracts/foo.contracts.mts
// ✅ shared value lives in a contracts module
export const SHARED_CONST = "value";
```

```ts
// src/foo/a.service.mts
// ✅ import from a contracts module instead
import { SHARED_CONST } from "../contracts/foo.contracts.mts";
```

Imports from non-service files (helpers, contracts, packages) are fine:

```ts
// src/foo/a.service.mts
import { x } from "./helper.mts";            // ✅ not a service file
import { y } from "../contracts/index.mts";  // ✅ contracts module
```

## When Not To Use It

This rule is intended for codebases that follow the Digital-Alchemy service model where services
communicate through dependency injection. If your project deliberately allows direct service-to-service
imports or does not use the `*.service.mts` convention, you can disable this rule.

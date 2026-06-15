# Require a LoadedModules declaration merge in the same file as CreateApplication/CreateLibrary, after the definition (`module-declaration-merge`)

<!-- end auto-generated rule header -->

## What this rule enforces

When a Digital-Alchemy application or library is created via `CreateApplication` or
`CreateLibrary`, the same file must satisfy three requirements:

1. It must contain a `declare module "<source>"` block that re-opens the framework module.
2. That block must contain an `export interface LoadedModules` entry.
3. The key name in `LoadedModules` must match the `name` property passed to the factory.
4. The `declare module` block must appear **after** the factory definition, not before.

The rule tracks which package `CreateApplication`/`CreateLibrary` was imported from and verifies
that the `declare module` re-opens that exact same package.

## Why

Digital-Alchemy uses TypeScript declaration merging to make every loaded module visible through
`TServiceParams`. Without the `declare module` block the types are incomplete: the application
compiles and runs but the framework cannot offer type-safe wiring for the module being created.

Placing the declaration before the definition causes a forward reference in the type system and
violates the expected file structure. Misspelling or omitting the `name` key in `LoadedModules`
means the module registers under the wrong name at the type level, breaking cross-module type
lookups.

## Incorrect

```ts
// ❌ missing declare module block entirely
import { CreateApplication } from "@digital-alchemy/core";

export const APP = CreateApplication({ name: "app", services: {} });
```

```ts
// ❌ declare module block appears before the factory definition
import { CreateApplication } from "@digital-alchemy/core";

declare module "@digital-alchemy/core" {
  export interface LoadedModules { app: typeof APP }
}

export const APP = CreateApplication({ name: "app", services: {} });
```

```ts
// ❌ LoadedModules key does not match the name property
import { CreateApplication } from "@digital-alchemy/core";

export const APP = CreateApplication({ name: "my_app", services: {} });

declare module "@digital-alchemy/core" {
  export interface LoadedModules { wrong_name: typeof APP }
}
```

## Correct

```ts
// ✅ declare module after the factory, key matches name property
import { CreateApplication } from "@digital-alchemy/core";

export const APP = CreateApplication({ name: "app", services: {} });

declare module "@digital-alchemy/core" {
  export interface LoadedModules { app: typeof APP }
}
```

```ts
// ✅ works the same for CreateLibrary and custom framework packages
import { CreateLibrary } from "@my-org/framework";

export const LIB = CreateLibrary({ name: "my_lib", services: {} });

declare module "@my-org/framework" {
  export interface LoadedModules { my_lib: typeof LIB }
}
```

## When Not To Use It

This rule is specific to the Digital-Alchemy framework's module-registration pattern. If your
project does not use `CreateApplication` or `CreateLibrary` from a Digital-Alchemy-compatible
package, you can disable this rule.

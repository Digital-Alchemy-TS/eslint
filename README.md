# @digital-alchemy/eslint

A framework-correctness ESLint plugin for [Digital-Alchemy](https://github.com/Digital-Alchemy-TS) TypeScript applications. It enforces patterns and constraints specific to the DA runtime — service wiring, module boundaries, lifecycle ordering — that generic TypeScript linters cannot model.

> **Note:** Rules that inspect type information require **typed linting** to be configured. Add `parserOptions.projectService: true` (or `parserOptions.project`) to your `languageOptions` block; without it, type-aware rules will be disabled or throw at load time.

## Installation

```bash
yarn add --dev @digital-alchemy/eslint
```

Requires ESLint 9 or 10 and Node 20+.

## Usage

Add the plugin to your flat config and extend the `recommended` config:

```js
// eslint.config.mjs
import daEslint from "@digital-alchemy/eslint";

export default [
  // Spread recommended to get all default rule settings
  daEslint.configs.recommended,

  // Your own overrides below
  {
    languageOptions: {
      parserOptions: {
        // Required for type-aware rules
        projectService: true,
      },
    },
  },
];
```

### Registering the plugin manually

If you prefer to enable only specific rules rather than the full recommended preset:

```js
import daEslint from "@digital-alchemy/eslint";

export default [
  {
    plugins: { "digital-alchemy": daEslint },
    rules: {
      // "digital-alchemy/<rule-name>": "error",
    },
  },
];
```

## Rules

<!-- begin auto-generated rules list -->

🔧 Automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/user-guide/command-line-interface#--fix).\
💭 Requires [type information](https://typescript-eslint.io/linting/typed-linting).

| Name                                                                                                                                    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 🔧 | 💭 |
| :-------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :- | :- |
| [module-declaration-merge](https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/module-declaration-merge.md)               | Require a LoadedModules declaration merge in the same file as CreateApplication/CreateLibrary, after the definition                                                                                                                                                                                                                                                                                                                                                                                                                  |    |    |
| [module-local-imports](https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/module-local-imports.md)                       | Module files must source their services from local subfolders, not parent directories                                                                                                                                                                                                                                                                                                                                                                                                                                                |    |    |
| [no-construction-side-effects](https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-construction-side-effects.md)       | Disallow side-effectful statements at the root of a service factory. Construction is for wiring definitions; side effects belong in lifecycle hooks.                                                                                                                                                                                                                                                                                                                                                                                 |    |    |
| [no-empty-config-default](https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-empty-config-default.md)                 | Disallow empty-string defaults in Digital Alchemy `configuration` entries                                                                                                                                                                                                                                                                                                                                                                                                                                                            |    |    |
| [no-service-class](https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-service-class.md)                               | Disallow class definitions in service files.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |    |    |
| [no-service-external-mutation](https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-service-external-mutation.md)       | Disallow mutating array methods called on bindings defined outside a service factory                                                                                                                                                                                                                                                                                                                                                                                                                                                 |    |    |
| [no-service-module-scope-state](https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-service-module-scope-state.md)     | `.service.mts` files must not declare module-scope mutable or derived state; static constants (primitive literals, static arrays/objects, `new Map/Set([...literals])`, static binary expressions, and hoistable computed expressions like `[...].join(SEP)`) are allowed at module scope per `no-service-primitive-const`. All runtime state must live in the service factory closure. Complements (does not duplicate) `no-service-primitive-const` (which targets static consts INSIDE the factory) and `service-preamble-limit`. |    |    |
| [no-sibling-service-import](https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-sibling-service-import.md)             | `.service.mts` files must not import from sibling service files. Move shared constants/types to a contracts module and share logic through the framework (dependency injection).                                                                                                                                                                                                                                                                                                                                                     |    |    |
| [no-toplevel-config](https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-toplevel-config.md)                           | Disallow top-level config access in DA service functions                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |    |    |
| [no-undeclared-module-dependency](https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-undeclared-module-dependency.md) | Disallow a service referencing a module (via TServiceParams or config.<module>) that its owner does not declare in depends/libraries.                                                                                                                                                                                                                                                                                                                                                                                                |    | 💭 |
| [no-unnecessary-priority-init](https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-unnecessary-priority-init.md)       | Disallow a priorityInit entry that no sibling reads during construction (it orders nothing).                                                                                                                                                                                                                                                                                                                                                                                                                                         |    | 💭 |
| [no-unused-service-params](https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-unused-service-params.md)               | Disallow destructuring a TServiceParams member that is never used in a service.                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 🔧 |    |
| [priority-init-order](https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/priority-init-order.md)                         | Disallow a priorityInit order where a producer wires after a consumer that reads it during construction.                                                                                                                                                                                                                                                                                                                                                                                                                             |    | 💭 |
| [require-priority-init](https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/require-priority-init.md)                     | Require a service to be listed in priorityInit when a sibling reads its API during construction.                                                                                                                                                                                                                                                                                                                                                                                                                                     |    | 💭 |

<!-- end auto-generated rules list -->

## Typed linting

Many rules in this plugin inspect TypeScript type information. To enable them you must configure typed linting in your project:

```js
// eslint.config.mjs
export default [
  {
    languageOptions: {
      parserOptions: {
        projectService: true,           // recommended (ESLint 9+)
        // OR: project: ["tsconfig.json"],  // explicit path form
      },
    },
  },
];
```

Without typed linting, type-aware rules will either be silently skipped or will produce a configuration error at startup.

## Links

- [Digital-Alchemy core](https://github.com/Digital-Alchemy-TS/core)
- [Documentation](https://docs.digital-alchemy.app)
- [Bugs / feature requests](https://github.com/Digital-Alchemy-TS/eslint/issues/new/choose)
- [Sponsor](https://github.com/sponsors/zoe-codez)

## License

MIT

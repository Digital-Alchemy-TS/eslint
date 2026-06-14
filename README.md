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
<!-- eslint-doc-generator inserts a rules table here automatically. Run `yarn update:docs` to regenerate. -->

No rules are defined yet — they arrive in a follow-up phase.

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

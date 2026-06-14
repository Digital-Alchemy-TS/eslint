# Disallow a service referencing a module (via TServiceParams or config.<module>) that its owner does not declare in depends/libraries (`no-undeclared-module-dependency`)

💭 This rule requires [type information](https://typescript-eslint.io/linting/typed-linting).

<!-- end auto-generated rule header -->

## What this rule enforces

A Digital-Alchemy service factory receives a `TServiceParams` object and may
reach other modules through it. This rule requires that any module a service
references is actually declared by the service's owning module in its `depends:`
or `libraries:` list.

A service references another module in one of two ways, both of which the rule
detects:

1. **Via `TServiceParams`** — destructuring the module off the factory's first
   parameter, e.g. `function ApiService({ other_module }: TServiceParams)`.
2. **Via `config`** — reading `config.<module>.<KEY>` anywhere in the factory
   body.

The rule operates on the whole program. It indexes every module declaration to
learn which module owns each service factory and what each module declares as a
dependency, then reports any referenced module that is a real module in the
program, is not the owner itself, and is not in the owner's declared
dependencies. Framework-provided injects (such as `logger`) and the module's own
name are never flagged. The report lands on the offending reference — the
destructured property or the `config.<module>` member access — in the file under
lint.

## Why

`TServiceParams` is structurally typed against every module loaded in the
application, so referencing an undeclared module still compiles and still runs.
That is exactly what makes the omission dangerous: the code works by accident of
load order, but the dependency is invisible to the framework.

A module's `depends:` / `libraries:` list is its declared contract. The framework
uses it to order wiring and to express what a module needs to function. When a
service reaches a module that the owner never declared, that contract no longer
reflects reality: wiring order is no longer guaranteed, and a reader inspecting
the module cannot see the true dependency surface. Requiring the reference to be
declared keeps the contract honest and the wiring order sound.

## Incorrect

```ts
// api.service.mts — owned by module "my_app", which declares good_lib but not bad_lib
export function ApiService({ bad_lib, config }: TServiceParams) {
  void bad_lib; // ❌ "bad_lib" referenced via TServiceParams but not declared
  void config.bad_lib.setting; // ❌ "bad_lib" referenced via config but not declared
}
```

## Correct

```ts
// my-app.app.mts — declares every module its services reference
export const MY_APP = CreateApplication({
  libraries: [GOOD_LIB, BAD_LIB], // ✅ now both are declared dependencies
  name: "my_app",
  services: { api: ApiService },
});
```

A service that only references declared dependencies and framework injects is
fine as-is:

```ts
// clean.service.mts
export function CleanService({ good_lib, config, logger }: TServiceParams) {
  void good_lib; // ✅ declared in libraries
  void logger; // ✅ framework inject, not a module
  void config.good_lib.setting; // ✅ declared in libraries
}
```

## When Not To Use It

This rule is intended for codebases that use the Digital-Alchemy
`CreateApplication` / `CreateLibrary` module model and treat `depends:` /
`libraries:` as the declared dependency contract. If your project does not use
that model, the rule has nothing to match and is safe to leave disabled.

## Requires type information

This rule is type-aware: it builds a whole-program index using the TypeScript
program exposed through `parserServices`. It only runs when type information is
available — configure `parserOptions.project` (and `tsconfigRootDir` where
needed) so the parser provides a program. Without type information the rule is a
no-op and reports nothing.

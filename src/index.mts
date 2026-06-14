import type { ESLint, Linter, Rule } from "eslint";

import moduleDeclarationMerge from "./rules/module-declaration-merge.mts";
import moduleLocalImports from "./rules/module-local-imports.mts";
import noConstructionSideEffects from "./rules/no-construction-side-effects.mts";
import noEmptyConfigDefault from "./rules/no-empty-config-default.mts";
import noServiceClass from "./rules/no-service-class.mts";
import noServiceExternalMutation from "./rules/no-service-external-mutation.mts";
import noServiceModuleScopeState from "./rules/no-service-module-scope-state.mts";
import noSiblingServiceImport from "./rules/no-sibling-service-import.mts";
import noToplevelConfig from "./rules/no-toplevel-config.mts";
import noUndeclaredModuleDependency from "./rules/no-undeclared-module-dependency.mts";
import noUnnecessaryPriorityInit from "./rules/no-unnecessary-priority-init.mts";
import noUnusedServiceParams from "./rules/no-unused-service-params.mts";
import priorityInitOrder from "./rules/priority-init-order.mts";
import requirePriorityInit from "./rules/require-priority-init.mts";

type PluginConfig = Linter.Config & { name: string };

type EslintPlugin = {
  meta: { name: string; version: string };
  rules: Record<string, Rule.RuleModule>;
  configs: Record<string, PluginConfig>;
};

const plugin: EslintPlugin = {
  meta: { name: "@digital-alchemy/eslint", version: "0.0.1" },
  rules: {
    "module-declaration-merge": moduleDeclarationMerge,
    "module-local-imports": moduleLocalImports,
    "no-construction-side-effects": noConstructionSideEffects,
    "no-empty-config-default": noEmptyConfigDefault,
    "no-service-class": noServiceClass,
    "no-service-external-mutation": noServiceExternalMutation,
    "no-service-module-scope-state": noServiceModuleScopeState,
    "no-sibling-service-import": noSiblingServiceImport,
    "no-toplevel-config": noToplevelConfig,
    "no-undeclared-module-dependency": noUndeclaredModuleDependency,
    "no-unnecessary-priority-init": noUnnecessaryPriorityInit,
    "no-unused-service-params": noUnusedServiceParams,
    "priority-init-order": priorityInitOrder,
    "require-priority-init": requirePriorityInit,
  },
  configs: {},
};

plugin.configs["recommended"] = {
  name: "digital-alchemy/recommended",
  plugins: { "digital-alchemy": plugin as unknown as ESLint.Plugin },
  rules: {
    "digital-alchemy/module-declaration-merge": "error",
    "digital-alchemy/module-local-imports": "error",
    "digital-alchemy/no-construction-side-effects": "error",
    "digital-alchemy/no-empty-config-default": "error",
    "digital-alchemy/no-service-class": "error",
    "digital-alchemy/no-service-external-mutation": "error",
    "digital-alchemy/no-service-module-scope-state": "error",
    "digital-alchemy/no-sibling-service-import": "error",
    "digital-alchemy/no-toplevel-config": "error",
    "digital-alchemy/no-undeclared-module-dependency": "error",
    "digital-alchemy/no-unnecessary-priority-init": "error",
    "digital-alchemy/no-unused-service-params": "error",
    "digital-alchemy/priority-init-order": "error",
    "digital-alchemy/require-priority-init": "error",
  },
};

export default plugin;

// Named re-exports allow CJS interop (require()) to resolve `rules` and `configs`
// directly on the module namespace object, which eslint-doc-generator needs.
export const { rules, configs } = plugin;

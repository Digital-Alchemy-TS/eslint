/**
 * Disallow module-scope mutable or derived state in `.service.mts` files.
 *
 * Static constants (primitive literals, static arrays/objects,
 * `new Map/Set([...literals])`, static binary expressions, and hoistable
 * computed expressions like `[...].join(SEP)`) are allowed at module scope.
 * Everything else — `let`, `var`, and `const` with a derived/non-static
 * initialiser — must move into the service factory closure.
 *
 * Complements (does not duplicate) `no-service-primitive-const` (which targets
 * static consts INSIDE the factory) and `service-preamble-limit`.
 */

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

import { isHoistableStatic } from "../lib/static-init.mts";
import type { PluginDocs } from "../lib/types.mts";

type MessageIds = "noModuleScopeState";

const rule: TSESLint.RuleModule<MessageIds, [], PluginDocs> = {
  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? "";
    if (!filename.endsWith(".service.mts")) {
      return {};
    }

    function checkDeclaration(node: TSESTree.VariableDeclaration): void {
      const parent = node.parent;
      const isTopLevel =
        parent?.type === "Program" ||
        (parent?.type === "ExportNamedDeclaration" && parent.parent?.type === "Program");
      if (!isTopLevel) {
        return;
      }

      const sourceCode: TSESLint.SourceCode = context.sourceCode;

      for (const declarator of node.declarations) {
        // let/var: always mutable -- flag unconditionally
        if (node.kind === "let" || node.kind === "var") {
          context.report({ messageId: "noModuleScopeState", node: declarator });
          continue;
        }
        // const: only flag when the init is NOT hoistable-static (i.e. derived/mutable).
        // At module scope, boundaryNode is false — any resolved binding is hoistable.
        const initNode = declarator.init;
        const isDerivedConst =
          node.kind === "const" && !!initNode && !isHoistableStatic(initNode, sourceCode, false);
        if (isDerivedConst) {
          context.report({ messageId: "noModuleScopeState", node: declarator });
        }
      }
    }

    return {
      VariableDeclaration: checkDeclaration,
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description:
        "`.service.mts` files must not declare module-scope mutable or derived state; " +
        "static constants (primitive literals, static arrays/objects, `new Map/Set([...literals])`, " +
        "static binary expressions, and hoistable computed expressions like `[...].join(SEP)`) are " +
        "allowed at module scope per `no-service-primitive-const`. " +
        "All runtime state must live in the service factory closure. " +
        "Complements (does not duplicate) `no-service-primitive-const`" +
        " (which targets static consts INSIDE the factory) and `service-preamble-limit`.",
      recommended: true,
      url: "https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-service-module-scope-state.md",
    },
    messages: {
      noModuleScopeState: [
        "`.service.mts` files must not declare module-scope mutable or derived state;",
        "move it into the service factory closure.",
        "Static constants are allowed at module scope per `no-service-primitive-const`.",
      ].join(" "),
    },
    schema: [],
    type: "problem",
  },
};

export default rule;

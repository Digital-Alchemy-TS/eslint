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

import type { Rule } from "eslint";

import { isHoistableStatic } from "../lib/static-init.mts";

type NodeLike = {
  type: string;
  [key: string]: unknown;
};

const rule: Rule.RuleModule = {
  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? "";
    if (!filename.endsWith(".service.mts")) {
      return {};
    }

    function checkDeclaration(node: Rule.Node): void {
      const n = node as unknown as {
        kind: string;
        declarations: Array<{ init?: NodeLike }>;
        parent?: { type: string; parent?: { type: string } };
      };
      const parent = n.parent;
      const isTopLevel =
        parent?.type === "Program" ||
        (parent?.type === "ExportNamedDeclaration" && parent.parent?.type === "Program");
      if (!isTopLevel) {
        return;
      }

      const declarations = (node as unknown as { declarations: Rule.Node[] }).declarations;
      const rawDeclarations = n.declarations;

      for (let i = 0; i < rawDeclarations.length; i++) {
        const declarator = rawDeclarations[i];
        const declaratorNode = declarations[i];
        // let/var: always mutable -- flag unconditionally
        if (["let", "var"].includes(n.kind)) {
          context.report({ messageId: "noModuleScopeState", node: declaratorNode });
          continue;
        }
        // const: only flag when the init is NOT hoistable-static (i.e. derived/mutable).
        // At module scope, boundaryNode is undefined — any resolved binding is hoistable.
        const isDerivedConst =
          n.kind === "const" &&
          !isHoistableStatic(
            declarator.init as NodeLike,
            context.sourceCode,
            undefined as unknown as NodeLike,
          );
        if (isDerivedConst) {
          context.report({ messageId: "noModuleScopeState", node: declaratorNode });
        }
      }
    }

    return {
      VariableDeclaration: checkDeclaration,
    };
  },

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

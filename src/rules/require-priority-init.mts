/**
 * Require a service in `priorityInit` when a sibling reads its API at
 * construction time.
 *
 * `priorityInit` is the single knob for intra-module boot order. A service read
 * by a sibling at construction time (top-level factory code, not a lifecycle
 * callback) MUST be listed in `priorityInit` — full stop. Declaration order is
 * deliberately NOT treated as a second ordering mechanism: relying on the order
 * of the `services` object to sequence boot means tuning boot order in two
 * places, and a service absent from `priorityInit` must mean "not participating
 * in boot ordering at all." So a construction-read producer that is not listed
 * is an error even when it happens to be declared before its consumer.
 *
 * A producer that IS listed but ordered after its consumer is the sibling order
 * rule's job, not this rule: the companion `priority-init-order` rule handles
 * declared-but-misordered entries, while this rule handles missing entries.
 *
 * The construction-read facts are whole-program ({@link getModuleIndex}); the
 * report lands on the module's `priorityInit` array (or the declaration call
 * when there is no array yet). Requires type information; no-op without it.
 */

import type { TSESTree } from "@typescript-eslint/utils";
import type { Rule } from "eslint";

import { consumedKeys, getModuleIndex, moduleAtDecl, programFromContext } from "../lib/module-index.mts";
import { moduleCallFacts } from "../lib/priority-init-ast.mts";

const rule: Rule.RuleModule = {
  create(context) {
    const acquired = programFromContext(context);
    if (!acquired) {
      return {};
    }
    const index = getModuleIndex(acquired.program, acquired.checker);
    const filename = context.filename ?? context.getFilename();

    return {
      CallExpression(node) {
        const facts = moduleCallFacts(node as unknown as TSESTree.CallExpression);
        const entry = facts && moduleAtDecl(index, filename, facts.constName);
        if (!facts || !entry) {
          return;
        }
        const listed = new Set(facts.priorityInit.map(element => element.key));
        // Any service a sibling construction-reads must be listed in priorityInit,
        // regardless of where it sits in the services declaration order.
        for (const producer of consumedKeys(entry.constructionReads)) {
          if (!listed.has(producer)) {
            context.report({
              data: { module: facts.name, service: producer },
              messageId: "missing",
              node: facts.priorityNode as unknown as Rule.Node,
            });
          }
        }
      },
    };
  },
  meta: {
    docs: {
      description:
        "Require a service to be listed in priorityInit when a sibling reads its API during construction.",
      recommended: true,
      // `requiresTypeChecking` is a typescript-eslint doc convention that ESLint's
      // own `RulesMetaDocs` type does not declare; widen so eslint-doc-generator
      // and consumers can read it without a type error.
      requiresTypeChecking: true,
      url: "https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/require-priority-init.md",
    } as Rule.RuleMetaData["docs"] & { requiresTypeChecking: boolean },
    messages: {
      missing: [
        "A sibling reads `{{service}}` during construction, but `{{module}}` does not list it ",
        "in priorityInit. Boot order must be controlled by priorityInit, not the services ",
        "declaration order. Add `{{service}}` to priorityInit.",
      ].join(""),
    },
    schema: [],
    type: "problem",
  },
};

export default rule;

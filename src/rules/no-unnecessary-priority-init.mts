/**
 * Flag a `priorityInit` entry that no sibling reads at construction time.
 *
 * `priorityInit` only earns its place by forcing a service to wire before a
 * sibling that reads its API during construction. An entry no sibling
 * construction-reads orders nothing (a one-service module's entry, or a service
 * only ever used inside lifecycle callbacks) and should be removed. Cross-module
 * consumption via `register()`/`addProvider` does NOT count: `priorityInit`
 * cannot order across modules — that is `depends`/`libraries`'s job.
 *
 * Construction-read facts are whole-program ({@link getModuleIndex}); the report
 * lands on the offending `priorityInit` string element. Requires type
 * information; no-op without it.
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
        const consumed = consumedKeys(entry.constructionReads);
        for (const element of facts.priorityInit) {
          if (!consumed.has(element.key)) {
            context.report({
              data: { module: facts.name, service: element.key },
              messageId: "unused",
              node: element.node as unknown as Rule.Node,
            });
          }
        }
      },
    };
  },
  meta: {
    docs: {
      description:
        "Disallow a priorityInit entry that no sibling reads during construction (it orders nothing).",
      recommended: true,
      // `requiresTypeChecking` is a typescript-eslint doc convention that ESLint's
      // own `RulesMetaDocs` type does not declare; widen so eslint-doc-generator
      // and consumers can read it without a type error.
      requiresTypeChecking: true,
      url: "https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-unnecessary-priority-init.md",
    } as Rule.RuleMetaData["docs"] & { requiresTypeChecking: boolean },
    messages: {
      unused: [
        "No sibling reads `{{service}}` during construction, so its priorityInit entry in ",
        "`{{module}}` orders nothing. Remove it.",
      ].join(""),
    },
    schema: [],
    type: "problem",
  },
};

export default rule;

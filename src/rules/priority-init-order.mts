/**
 * Flag a `priorityInit` ordering where a producer wires after a consumer that
 * reads it at construction.
 *
 * The wiring sequence is `priorityInit` first (in listed order), then the
 * remaining services in declaration order. If service A's factory reads service
 * B's API during construction, B must wire before A; otherwise A reads
 * `undefined`. When the resolved sequence puts the producer after its consumer,
 * the order is wrong.
 *
 * Consumer→producer construction reads are whole-program ({@link getModuleIndex});
 * the report lands on the producer's `priorityInit` element (or the array node
 * when the producer is not listed). Requires type information; no-op without it.
 */

import type { TSESTree } from "@typescript-eslint/utils";
import type { Rule } from "eslint";

import { getModuleIndex, moduleAtDecl, programFromContext, wireIndex } from "../lib/module-index.mts";
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
        const priorityKeys = facts.priorityInit.map(element => element.key);
        const listed = new Set(priorityKeys);
        const sequence = wireIndex(facts.serviceKeys, priorityKeys);
        const elementByKey = new Map(
          facts.priorityInit.map(element => [element.key, element.node]),
        );

        for (const [consumer, producers] of entry.constructionReads) {
          for (const producer of producers) {
            const consumerAt = sequence.get(consumer);
            const producerAt = sequence.get(producer);
            const consumerMissing = consumerAt == undefined;
            const producerMissing = producerAt == undefined;
            const unordered = consumerMissing || producerMissing;
            // An unlisted producer mis-ordered is require-priority-init's job.
            if (producer === consumer || !listed.has(producer) || unordered) {
              continue;
            }
            if (producerAt > consumerAt) {
              context.report({
                data: { consumer, module: facts.name, producer },
                messageId: "order",
                node: (elementByKey.get(producer) ?? facts.priorityNode) as unknown as Rule.Node,
              });
            }
          }
        }
      },
    };
  },
  meta: {
    docs: {
      description:
        "Disallow a priorityInit order where a producer wires after a consumer that reads it during construction.",
      recommended: true,
      // `requiresTypeChecking` is a typescript-eslint doc convention that ESLint's
      // own `RulesMetaDocs` type does not declare; widen so eslint-doc-generator
      // and consumers can read it without a type error.
      requiresTypeChecking: true,
      url: "https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/priority-init-order.md",
    } as Rule.RuleMetaData["docs"] & { requiresTypeChecking: boolean },
    messages: {
      order: [
        "`{{consumer}}` reads `{{producer}}` during construction,",
        "but in `{{module}}` `{{producer}}` wires after it.",
        "Move `{{producer}}` earlier in priorityInit.",
      ].join(" "),
    },
    schema: [],
    type: "problem",
  },
};

export default rule;

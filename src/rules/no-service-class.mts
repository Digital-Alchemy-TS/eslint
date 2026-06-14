/**
 * Disallow class definitions in `.service.mts` files.
 *
 * Service files hold service functions, not class definitions. A class
 * (declaration or expression) in a service file is a structural violation —
 * shared types belong in helpers/contracts and stateful constructs do not
 * belong in the service layer at all.
 *
 * Flags both `class Foo {}` (ClassDeclaration) and `const Foo = class {}`
 * (ClassExpression).
 *
 * File-scoped to `**\/*.service.mts` via both the `base.mjs` override block and
 * a filename guard inside `create()`. It does NOT trigger for `.test.mts`
 * files — test doubles may define throwaway classes.
 */

import type { Rule } from "eslint";

const SERVICE_FILE_PATTERN = /\.service\.mts$/u;
const TEST_FILE_PATTERN = /\.test\.mts$/u;

const rule: Rule.RuleModule = {
  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? "";

    if (!SERVICE_FILE_PATTERN.test(filename)) {
      return {};
    }
    if (TEST_FILE_PATTERN.test(filename)) {
      return {};
    }

    return {
      "ClassDeclaration, ClassExpression"(node: Rule.Node) {
        context.report({ messageId: "noClass", node });
      },
    };
  },

  meta: {
    docs: {
      description: "Disallow class definitions in service files.",
      recommended: true,
      url: "https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-service-class.md",
    },
    messages: {
      noClass: [
        "Classes may not be defined in a service file.",
        "Move it out of the service layer (helpers/contracts, or a dedicated module).",
      ].join(" "),
    },
    schema: [],
    type: "problem",
  },
};

export default rule;

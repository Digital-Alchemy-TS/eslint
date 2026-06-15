import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

import type { PluginDocs } from "../lib/types.mts";

type MessageIds = "noSiblingServiceImport";

const rule: TSESLint.RuleModule<MessageIds, [], PluginDocs> = {
  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (!filename.endsWith(".service.mts")) {
      return {};
    }

    function checkSource(sourceNode: TSESTree.StringLiteral) {
      const source = sourceNode.value;
      if (source.endsWith(".service.mts") || source.endsWith(".service.mjs")) {
        context.report({
          data: { source },
          messageId: "noSiblingServiceImport",
          node: sourceNode,
        });
      }
    }

    return {
      ExportAllDeclaration(node: TSESTree.ExportAllDeclaration) {
        if (node.source) {
          checkSource(node.source);
        }
      },
      ExportNamedDeclaration(node: TSESTree.ExportNamedDeclaration) {
        if (node.source) {
          checkSource(node.source);
        }
      },
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        checkSource(node.source);
      },
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: [
        "`.service.mts` files must not import from sibling service files.",
        "Move shared constants/types to a contracts module and share logic through the framework",
        "(dependency injection).",
      ].join(" "),
      recommended: true,
      url: "https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-sibling-service-import.md",
    },
    messages: {
      noSiblingServiceImport: [
        "A service file must not import from a sibling service file (`{{source}}`).",
        "Move shared constants/types to a contracts module, and share logic through the framework",
        "(dependency injection) -- not direct service-to-service imports.",
      ].join(" "),
    },
    schema: [],
    type: "problem",
  },
};

export default rule;

import type { Rule } from "eslint";

const rule: Rule.RuleModule = {
  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (!filename.endsWith(".service.mts")) {
      return {};
    }

    function checkSource(sourceNode: { value?: unknown } & Rule.Node) {
      const source = sourceNode?.value;
      if (typeof source !== "string") {
        return;
      }
      if (source.endsWith(".service.mts") || source.endsWith(".service.mjs")) {
        context.report({
          data: { source },
          messageId: "noSiblingServiceImport",
          node: sourceNode,
        });
      }
    }

    return {
      ExportAllDeclaration(node) {
        if (node.source) {
          checkSource(node.source as unknown as { value?: unknown } & Rule.Node);
        }
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          checkSource(node.source as unknown as { value?: unknown } & Rule.Node);
        }
      },
      ImportDeclaration(node) {
        checkSource(node.source as unknown as { value?: unknown } & Rule.Node);
      },
    };
  },
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

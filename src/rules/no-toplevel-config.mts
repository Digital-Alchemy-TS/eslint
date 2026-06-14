/**
 * Ban config.* member expressions at the top level of DA service functions.
 *
 * A "service function" is any function whose parameters destructure `config`
 * (e.g. `{ config, logger }: TServiceParams`). Config access is only allowed
 * inside nested functions, callbacks, or arrow functions — never as a direct
 * statement in the service body.
 */

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

import type { PluginDocs } from "../lib/types.mts";

type MessageIds = "toplevelConfig";

// Offset from `.length` to the index of the final stack element.
const LAST_INDEX_OFFSET = 1;
// Nesting depth at which a node sits directly in the service-function body.
const TOP_LEVEL_DEPTH = 0;

function hasConfigParam(node: TSESTree.FunctionLike): boolean {
  return node.params.some(
    param =>
      param.type === "ObjectPattern" &&
      param.properties.some(
        prop =>
          prop.type === "Property" &&
          prop.key.type === "Identifier" &&
          prop.key.name === "config",
      ),
  );
}

function isConciseArrow(node: TSESTree.FunctionLike): boolean {
  return node.type === "ArrowFunctionExpression" && node.body.type !== "BlockStatement";
}

const rule: TSESLint.RuleModule<MessageIds, [], PluginDocs> = {
  create(context) {
    const serviceStack: { depth: number; node: TSESTree.FunctionLike }[] = [];

    function enterFunction(node: TSESTree.FunctionLike) {
      if (serviceStack.length) {
        serviceStack[serviceStack.length - LAST_INDEX_OFFSET].depth++;
      }
      if (hasConfigParam(node) && !isConciseArrow(node)) {
        serviceStack.push({ depth: 0, node });
      }
    }

    function exitFunction(node: TSESTree.FunctionLike) {
      const top = serviceStack[serviceStack.length - LAST_INDEX_OFFSET];
      if (top?.node === node) {
        serviceStack.pop();
      }
      if (serviceStack.length) {
        serviceStack[serviceStack.length - LAST_INDEX_OFFSET].depth--;
      }
    }

    return {
      ArrowFunctionExpression: enterFunction,
      "ArrowFunctionExpression:exit": exitFunction,
      FunctionDeclaration: enterFunction,
      "FunctionDeclaration:exit": exitFunction,
      FunctionExpression: enterFunction,
      "FunctionExpression:exit": exitFunction,

      MemberExpression(node: TSESTree.MemberExpression) {
        if (!serviceStack.length) {
          return;
        }
        if (node.object.type !== "Identifier" || node.object.name !== "config") {
          return;
        }
        const top = serviceStack[serviceStack.length - LAST_INDEX_OFFSET];
        if (top.depth === TOP_LEVEL_DEPTH) {
          context.report({ messageId: "toplevelConfig", node });
        }
      },
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Disallow top-level config access in DA service functions",
      recommended: true,
      url: "https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-toplevel-config.md",
    },
    messages: {
      toplevelConfig: [
        "Config must not be accessed at the top level of a service function.",
        "Move config access inside a nested function or callback.",
      ].join(" "),
    },
    schema: [],
    type: "problem",
  },
};

export default rule;

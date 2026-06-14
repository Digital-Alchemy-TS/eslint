/**
 * Ban config.* member expressions at the top level of DA service functions.
 *
 * A "service function" is any function whose parameters destructure `config`
 * (e.g. `{ config, logger }: TServiceParams`). Config access is only allowed
 * inside nested functions, callbacks, or arrow functions — never as a direct
 * statement in the service body.
 */

import type { Rule } from "eslint";

const rule: Rule.RuleModule = {
  create(context) {
    // Offset from `.length` to the index of the final stack element.
    const LAST_INDEX_OFFSET = 1;
    // Nesting depth at which a node sits directly in the service-function body.
    const TOP_LEVEL_DEPTH = 0;
    const serviceStack: { depth: number; node: unknown }[] = [];

    function hasConfigParam(node: { params: unknown[] }): boolean {
      return node.params.some(param => {
        const p = param as { type: string; properties?: { type: string; key: { type: string; name?: string } }[] };
        return (
          p.type === "ObjectPattern" &&
          p.properties?.some(
            prop =>
              prop.type === "Property" &&
              prop.key.type === "Identifier" &&
              prop.key.name === "config",
          )
        );
      });
    }

    function isConciseArrow(node: { type: string; body: { type: string } }): boolean {
      return node.type === "ArrowFunctionExpression" && node.body.type !== "BlockStatement";
    }

    function enterFunction(node: { type: string; params: unknown[]; body: { type: string } }) {
      if (serviceStack?.length) {
        serviceStack[serviceStack.length - LAST_INDEX_OFFSET].depth++;
      }
      if (hasConfigParam(node) && !isConciseArrow(node)) {
        serviceStack.push({ depth: 0, node });
      }
    }

    function exitFunction(node: unknown) {
      const top = serviceStack[serviceStack.length - LAST_INDEX_OFFSET];
      if (top?.node === node) {
        serviceStack.pop();
      }
      if (serviceStack?.length) {
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

      MemberExpression(node) {
        if (!serviceStack?.length) {
          return;
        }
        if (node.object.type !== "Identifier" || (node.object as { name?: string }).name !== "config") {
          return;
        }
        const top = serviceStack[serviceStack.length - LAST_INDEX_OFFSET];
        if (top.depth === TOP_LEVEL_DEPTH) {
          context.report({ messageId: "toplevelConfig", node });
        }
      },
    };
  },
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
    type: "problem",
  },
};

export default rule;

/**
 * Disallow mutating array methods called on bindings defined outside a service factory.
 *
 * When a binding is defined at module scope (or imported), it is shared across
 * every invocation of any service factory that closes over it. Calling a
 * mutating array method (push, pop, splice, etc.) on such a binding inside a
 * service factory silently shares mutable state across invocations.
 *
 * The fix is simple: copy the external array locally first and mutate the copy.
 */

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

import { isHoistableStatic } from "../lib/static-init.mts";
import type { PluginDocs } from "../lib/types.mts";

type MessageIds = "noExternalMutation";

/**
 * Offset subtracted from `array.length` to index the final (top-of-stack)
 * element.
 *
 * Hard-coded rather than a tunable because the last element of any array is
 * always one before its length; a fixed indexing fact, not an operator setting.
 */
const STACK_TOP_OFFSET = 1;

/**
 * Array methods that mutate the receiver in-place. Calling any of these on a
 * binding defined outside the service factory shares mutable state across every
 * invocation of that factory.
 */
const MUTATING_METHODS = new Set([
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "fill",
  "copyWithin",
]);

function isTServiceParams(param: TSESTree.Parameter): boolean {
  if (param.type !== "ObjectPattern") {
    return false;
  }
  const ann = param.typeAnnotation?.typeAnnotation;
  if (ann?.type !== "TSTypeReference") {
    return false;
  }
  return ann.typeName.type === "Identifier" && ann.typeName.name === "TServiceParams";
}

type ServiceNode =
  | TSESTree.ArrowFunctionExpression
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression;

const rule: TSESLint.RuleModule<MessageIds, [], PluginDocs> = {
  create(context) {
    // Stack of service-function nodes currently open. We are "inside a service"
    // whenever the stack is non-empty — including within nested inner functions
    // (helpers, callbacks) declared inside the service factory.
    const serviceStack: ServiceNode[] = [];

    function enterFunction(node: ServiceNode): void {
      if (node.params.some(p => isTServiceParams(p))) {
        serviceStack.push(node);
      }
    }

    function exitFunction(node: ServiceNode): void {
      if (serviceStack[serviceStack.length - STACK_TOP_OFFSET] === node) {
        serviceStack.pop();
      }
    }

    return {
      ArrowFunctionExpression: enterFunction,
      "ArrowFunctionExpression:exit": exitFunction,
      CallExpression(node: TSESTree.CallExpression) {
        if (!serviceStack?.length) {
          return;
        }

        const { callee } = node;

        // Must be a non-computed member expression: receiver.method(...)
        if (callee.type !== "MemberExpression" || callee.computed) {
          return;
        }

        // Method name must be an Identifier in the mutating set
        const { property, object } = callee;
        if (property.type !== "Identifier") {
          return;
        }
        if (!MUTATING_METHODS.has(property.name)) {
          return;
        }

        // Receiver must be an Identifier
        if (object.type !== "Identifier") {
          return;
        }

        // The receiver must resolve to a binding defined OUTSIDE the factory
        // boundary (module-scope, imported, or global).
        const [factoryNode] = serviceStack;
        const sourceCode: TSESLint.SourceCode = context.sourceCode;
        if (!isHoistableStatic(object, sourceCode, factoryNode)) {
          return;
        }

        context.report({
          data: { method: property.name, name: object.name },
          messageId: "noExternalMutation",
          node,
        });
      },
      FunctionDeclaration: enterFunction,
      "FunctionDeclaration:exit": exitFunction,
      FunctionExpression: enterFunction,
      "FunctionExpression:exit": exitFunction,
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description:
        "Disallow mutating array methods called on bindings defined outside a service factory",
      recommended: true,
      url: "https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-service-external-mutation.md",
    },
    messages: {
      noExternalMutation: [
        "`{{name}}` is defined outside this service; mutating it with `.{{method}}()` inside a service factory",
        "shares state across invocations. Copy it locally (`const x = [...{{name}}]`) and mutate the copy.",
      ].join(" "),
    },
    schema: [],
    type: "problem",
  },
};

export default rule;

/**
 * Flag destructured `TServiceParams` members that are never used in a service
 * factory function.
 *
 * A service factory receives a single destructured `TServiceParams` argument:
 *
 *   export function WriterService({ logger, config }: TServiceParams) { ... }
 *
 * Pulling a member out of `TServiceParams` and never referencing it is not a
 * harmless unused variable — it is a critical flaw: it declares a dependency
 * the service does not actually have, polluting the wiring graph and masking
 * what the service really needs. Each unused destructured member is reported.
 *
 * Detection: a function whose first parameter is an `ObjectPattern` annotated
 * `: TServiceParams`. Each destructured binding with zero read references is
 * reported. Uses scope analysis (`getDeclaredVariables`) so shorthand and
 * renamed (`{ config: cfg }`) bindings are both handled.
 *
 * File-scoped to `**\/*.service.mts` via both the `base.mjs` override block and
 * a filename guard inside `create()`.
 */

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

import type { PluginDocs } from "../lib/types.mts";

type MessageIds = "unusedParam";

const SERVICE_FILE_PATTERN = /\.service\.mts$/u;
const TEST_FILE_PATTERN = /\.test\.mts$/u;

/**
 * Index distance to an immediately adjacent array element (the previous or next
 * neighbour).
 *
 * Hard-coded rather than a tunable because "adjacent" means exactly one
 * position away; it is a fixed indexing fact, not an operator setting.
 */
const NEIGHBOR_OFFSET = 1;

/**
 * Type predicate narrowing a `TSESTree.Parameter` to `TSESTree.ObjectPattern`
 * whose type annotation is `: TServiceParams`.
 */
function isServiceParamsPattern(param: TSESTree.Parameter): param is TSESTree.ObjectPattern {
  if (param.type !== "ObjectPattern") {
    return false;
  }
  const annotation = param.typeAnnotation?.typeAnnotation;
  return (
    annotation?.type === "TSTypeReference" &&
    annotation.typeName.type === "Identifier" &&
    annotation.typeName.name === "TServiceParams"
  );
}

const rule: TSESLint.RuleModule<MessageIds, [], PluginDocs> = {
  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? "";

    if (!SERVICE_FILE_PATTERN.test(filename)) {
      return {};
    }
    if (TEST_FILE_PATTERN.test(filename)) {
      return {};
    }

    const sourceCode: TSESLint.SourceCode = context.sourceCode;

    function check(node: TSESTree.FunctionLike) {
      const [param] = node.params;
      if (!isServiceParamsPattern(param)) {
        return;
      }

      // `param` is now narrowed to TSESTree.ObjectPattern.
      // Map each binding identifier node declared by the ObjectPattern back to
      // its owning property, so we only judge TServiceParams members (not other
      // locals) and can target the property for removal.
      const bindingToProp = new Map<TSESTree.Node, TSESTree.ObjectLiteralElement | TSESTree.RestElement>();
      for (const prop of param.properties) {
        if (prop.type === "Property" && prop.value.type === "Identifier") {
          bindingToProp.set(prop.value, prop);
        } else if (prop.type === "RestElement" && prop.argument.type === "Identifier") {
          bindingToProp.set(prop.argument, prop);
        }
      }

      for (const variable of sourceCode.getDeclaredVariables(node)) {
        const prop = variable.defs.map(def => bindingToProp.get(def.name)).find(Boolean);
        if (!prop) {
          continue;
        }

        const used = variable.references.some(ref => ref.isRead());
        if (used) {
          continue;
        }

        // Only autofix a plain Property when the pattern keeps at least one other
        // member — removing a RestElement or emptying the pattern is left to the
        // author.
        const hasAnotherMember = param.properties.some(other => other !== prop);
        const canFix = prop.type === "Property" && hasAnotherMember;

        const reportNode = variable.identifiers[0] ?? param;

        context.report({
          data: { name: variable.name },
          messageId: "unusedParam",
          node: reportNode,
          ...(canFix
            ? {
                fix(fixer: TSESLint.RuleFixer): TSESLint.RuleFix {
                  const props = param.properties;
                  const idx = props.indexOf(prop as typeof props[number]);
                  const isLast = idx === props.length - NEIGHBOR_OFFSET;
                  if (!isLast) {
                    // Not last: drop through the start of the next property,
                    // taking the trailing comma and whitespace with it.
                    return fixer.removeRange([
                      props[idx].range[0],
                      props[idx + NEIGHBOR_OFFSET].range[0],
                    ]);
                  }
                  // Last: drop from the end of the previous property, taking the
                  // preceding comma and whitespace with it.
                  return fixer.removeRange([props[idx - NEIGHBOR_OFFSET].range[1], props[idx].range[1]]);
                },
              }
            : {}),
        });
      }
    }

    return {
      ArrowFunctionExpression: check,
      FunctionDeclaration: check,
      FunctionExpression: check,
    };
  },

  defaultOptions: [],
  meta: {
    docs: {
      description:
        "Disallow destructuring a TServiceParams member that is never used in a service.",
      recommended: true,
      url: "https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-unused-service-params.md",
    },
    fixable: "code",
    messages: {
      unusedParam: [
        "`{{name}}` is destructured from TServiceParams but never used. A declared-but-unused ",
        "service dependency is a critical flaw -- remove it.",
      ].join(""),
    },
    schema: [],
    type: "problem",
  },
};

export default rule;

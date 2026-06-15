/**
 * Flag a service that references another DA module without its owning
 * library/application declaring that module in `depends:` / `libraries:`.
 *
 * A service references a module either by destructuring it from the
 * `TServiceParams` factory parameter, or by reading `config.<module>.<KEY>`.
 * Both compile and run because `TServiceParams` is structurally typed against
 * every loaded module — but the dependency is undeclared, so wiring order and
 * the module's public contract no longer reflect reality.
 *
 * This is a cross-file rule: the owner of a service factory and that owner's
 * declared deps live in the module file, not the service file. Those facts come
 * from the program-wide {@link getModuleIndex}; the report lands on the actual
 * reference node in the file under lint (the destructured element / `config.X`
 * access), so editor and CLI diagnostics point at the offending source.
 *
 * Requires type information (`parserServices.program`). Degrades to a no-op when
 * unavailable.
 */

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

import { getModuleIndex, programFromContext } from "../lib/module-index.mts";
import type { PluginDocs } from "../lib/types.mts";
import type { AstNodeLike } from "../lib/utils.mts";
import { isAstNode } from "../lib/utils.mts";

type MessageIds = "viaConfig" | "viaParam";

/** The documentable name of a service-factory function node, or "" when none. */
function factoryName(node: TSESTree.FunctionLike): string {
  if (node.type === "FunctionDeclaration") {
    return node.id?.type === "Identifier" ? node.id.name : "";
  }
  const parent = node.parent;
  if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") {
    return parent.id.name;
  }
  return "";
}

/**
 * Type predicate that narrows an `AstNodeLike` to `AstNodeLike & TSESTree.MemberExpression`.
 * The intersection is sound: both are object types, and the `type` discriminant confirms the
 * runtime shape is a MemberExpression — no erasure, no `unknown` indirection.
 */
function isMemberExpression(
  node: AstNodeLike,
): node is AstNodeLike & TSESTree.MemberExpression {
  return node.type === "MemberExpression";
}

/** Recursively visit every descendant AST node (skipping the `parent` backref). */
function walk(node: unknown, visit: (node: AstNodeLike) => void): void {
  if (!isAstNode(node)) {
    return;
  }
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === "parent") {
      continue;
    }
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        walk(item, visit);
      }
    } else {
      walk(child, visit);
    }
  }
}

/** True when a function's first parameter is a `TServiceParams` object pattern. */
function destructuresServiceParams(
  node: TSESTree.FunctionLike,
  sourceCode: TSESLint.SourceCode,
): boolean {
  const [firstParam] = node.params;
  if (firstParam?.type !== "ObjectPattern" || !firstParam.typeAnnotation) {
    return false;
  }
  return sourceCode.getText(firstParam.typeAnnotation).includes("TServiceParams");
}

const rule: TSESLint.RuleModule<MessageIds, [], PluginDocs> = {
  create(context) {
    const acquired = programFromContext(context);
    if (!acquired) {
      return {};
    }
    const index = getModuleIndex(acquired.program, acquired.checker);
    const sourceCode = context.sourceCode;

    function check(node: TSESTree.FunctionLike) {
      const ownerEntry = index.serviceOwners.get(factoryName(node));
      if (!ownerEntry) {
        return;
      }
      const owner = ownerEntry.id;
      const declared = ownerEntry.declaredDeps;
      const reported = new Set<string>();
      const undeclared = (dep: string) =>
        index.moduleIds.has(dep) && dep !== owner && !declared.has(dep);

      // (1) modules destructured from the TServiceParams parameter.
      if (destructuresServiceParams(node, sourceCode)) {
        const [firstParam] = node.params;
        if (firstParam?.type !== "ObjectPattern") {
          return;
        }
        for (const property of firstParam.properties) {
          if (property.type !== "Property" || property.key.type !== "Identifier") {
            continue;
          }
          const dep = property.key.name;
          if (undeclared(dep) && !reported.has(`param:${dep}`)) {
            reported.add(`param:${dep}`);
            context.report({
              data: { dep, owner },
              messageId: "viaParam",
              node: property,
            });
          }
        }
      }

      // (2) `config.<module>.<KEY>` reads anywhere in the factory body.
      walk(node.body, member => {
        if (!isMemberExpression(member)) {
          return;
        }
        if (member.object.type !== "Identifier" || member.object.name !== "config") {
          return;
        }
        if (member.property.type !== "Identifier") {
          return;
        }
        const dep = member.property.name;
        if (undeclared(dep) && !reported.has(`config:${dep}`)) {
          reported.add(`config:${dep}`);
          context.report({
            data: { dep, owner },
            messageId: "viaConfig",
            node: member,
          });
        }
      });
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
      description: [
        "Disallow a service referencing a module (via TServiceParams or config.<module>) that ",
        "its owner does not declare in depends/libraries.",
      ].join(""),
      recommended: true,
      requiresTypeChecking: true,
      url: "https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-undeclared-module-dependency.md",
    },
    messages: {
      viaConfig: [
        "Service reads `config.{{dep}}.*`, but module `{{owner}}` does not declare `{{dep}}` ",
        "in depends/libraries. Add it to the dependency list.",
      ].join(""),
      viaParam: [
        "Service destructures module `{{dep}}` from TServiceParams, but `{{owner}}` does not ",
        "declare it in depends/libraries. Add it to the dependency list.",
      ].join(""),
    },
    schema: [],
    type: "problem",
  },
};

export default rule;

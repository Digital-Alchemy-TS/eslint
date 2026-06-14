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

import type { TSESTree } from "@typescript-eslint/utils";
import type { Rule, SourceCode } from "eslint";

import { getModuleIndex, programFromContext } from "../lib/module-index.mts";
import type { AstNodeLike } from "../lib/utils.mts";
import { isAstNode } from "../lib/utils.mts";

/** The documentable name of a service-factory function node, or "" when none. */
function factoryName(node: TSESTree.Node): string {
  if (node.type === "FunctionDeclaration") {
    return node.id?.type === "Identifier" ? node.id.name : "";
  }
  const parent = node.parent;
  if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") {
    return parent.id.name;
  }
  return "";
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
function destructuresServiceParams(node: TSESTree.Node, sourceCode: SourceCode): boolean {
  const params = (node as TSESTree.FunctionLike).params;
  const [firstParam] = params;
  if (firstParam?.type !== "ObjectPattern" || !firstParam.typeAnnotation) {
    return false;
  }
  return sourceCode
    .getText(firstParam.typeAnnotation as unknown as Rule.Node)
    .includes("TServiceParams");
}

const rule: Rule.RuleModule = {
  create(context) {
    const acquired = programFromContext(context);
    if (!acquired) {
      return {};
    }
    const index = getModuleIndex(acquired.program, acquired.checker);
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    function check(node: TSESTree.Node) {
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
        const [firstParam] = (node as TSESTree.FunctionLike).params;
        for (const property of (firstParam as TSESTree.ObjectPattern).properties) {
          if (property.type !== "Property" || property.key.type !== "Identifier") {
            continue;
          }
          const dep = property.key.name;
          if (undeclared(dep) && !reported.has(`param:${dep}`)) {
            reported.add(`param:${dep}`);
            context.report({
              data: { dep, owner },
              messageId: "viaParam",
              node: property as unknown as Rule.Node,
            });
          }
        }
      }

      // (2) `config.<module>.<KEY>` reads anywhere in the factory body.
      walk((node as TSESTree.FunctionLike).body, member => {
        const expression = member as unknown as TSESTree.Node;
        if (expression.type !== "MemberExpression" || expression.object.type !== "Identifier") {
          return;
        }
        if (expression.object.name !== "config" || expression.property.type !== "Identifier") {
          return;
        }
        const dep = expression.property.name;
        if (undeclared(dep) && !reported.has(`config:${dep}`)) {
          reported.add(`config:${dep}`);
          context.report({
            data: { dep, owner },
            messageId: "viaConfig",
            node: expression as unknown as Rule.Node,
          });
        }
      });
    }

    return {
      ArrowFunctionExpression: node => check(node as unknown as TSESTree.Node),
      FunctionDeclaration: node => check(node as unknown as TSESTree.Node),
      FunctionExpression: node => check(node as unknown as TSESTree.Node),
    };
  },
  meta: {
    docs: {
      description: [
        "Disallow a service referencing a module (via TServiceParams or config.<module>) that ",
        "its owner does not declare in depends/libraries.",
      ].join(""),
      recommended: true,
      // `requiresTypeChecking` is a typescript-eslint doc convention that ESLint's
      // own `RulesMetaDocs` type does not declare; widen so eslint-doc-generator
      // and consumers can read it without a type error.
      requiresTypeChecking: true,
      url: "https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-undeclared-module-dependency.md",
    } as Rule.RuleMetaData["docs"] & { requiresTypeChecking: boolean },
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

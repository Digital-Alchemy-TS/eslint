/**
 * Require a module file to source its services from local subfolders, not from
 * a parent directory.
 *
 * A `.module.mts` file wires its own services. Those services should be imported
 * from the module's own subtree (a `./services` subfolder, a package, etc.), not
 * reached up through `..` into a sibling or ancestor module's territory. Pulling
 * a service across a parent boundary blurs which module actually owns it and
 * couples the two modules' layouts together.
 *
 * Libraries are exempt: importing a `LIB_*` declaration from a parent directory
 * is the normal composition path and is not flagged. Only entries that appear in
 * the `services` object and resolve to a parent-directory import are reported.
 */

import type { TSESTree } from "@typescript-eslint/utils";
import type { Rule } from "eslint";

import type { AstNodeLike } from "../lib/utils.mts";

// The `VariableDeclaration` that a top-level statement actually declares,
// unwrapping an `export` wrapper, or undefined when the statement is neither.
function declaredVariable(stmt: AstNodeLike): TSESTree.VariableDeclaration {
  if (!["ExportNamedDeclaration", "VariableDeclaration"].includes(stmt.type)) {
    return undefined;
  }
  const node = stmt as unknown as TSESTree.Node;
  const decl =
    node.type === "ExportNamedDeclaration" ? node.declaration : node;
  return decl?.type === "VariableDeclaration" ? decl : undefined;
}

// The `services: { ... }` object passed as the first argument of an init call
// expression, or undefined when the declarator is not such a factory call.
function servicesObjectOf(declarator: TSESTree.VariableDeclarator): TSESTree.ObjectExpression {
  if (declarator.init?.type !== "CallExpression") {
    return undefined;
  }
  const [firstArg] = declarator.init.arguments;
  if (firstArg?.type !== "ObjectExpression") {
    return undefined;
  }
  const servicesProp = firstArg.properties.find(
    p => p.type === "Property" && p.key.type === "Identifier" && p.key.name === "services",
  );
  return servicesProp?.type === "Property" && servicesProp.value.type === "ObjectExpression"
    ? servicesProp.value
    : undefined;
}

interface ParentImport {
  readonly node: TSESTree.ImportDeclaration;
  readonly source: string;
}

const rule: Rule.RuleModule = {
  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (!filename.endsWith(".module.mts")) {
      return {};
    }

    const parentImports = new Map<string, ParentImport>();

    function reportServiceObject(servicesObject: TSESTree.ObjectExpression) {
      for (const prop of servicesObject.properties) {
        if (prop.type !== "Property") {
          continue;
        }
        const val = prop.value;
        const name = val.type === "Identifier" ? val.name : undefined;
        if (!name) {
          continue;
        }
        const imported = parentImports.get(name);
        if (imported) {
          context.report({
            data: { name, source: imported.source },
            messageId: "noParentService",
            node: imported.node as unknown as Rule.Node,
          });
        }
      }
    }

    return {
      ImportDeclaration(node) {
        const source = node.source?.value;
        if (typeof source !== "string" || !source.startsWith("..")) {
          return;
        }
        for (const spec of node.specifiers) {
          if (spec.local?.name) {
            parentImports.set(spec.local.name, {
              node: node as unknown as TSESTree.ImportDeclaration,
              source,
            });
          }
        }
      },

      "Program:exit"() {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const scope = sourceCode.scopeManager.globalScope;
        if (!scope) {
          return;
        }

        for (const stmt of sourceCode.ast.body) {
          const decl = declaredVariable(stmt as unknown as AstNodeLike);
          if (!decl) {
            continue;
          }
          for (const declarator of decl.declarations) {
            const servicesObject = servicesObjectOf(declarator);
            if (servicesObject) {
              reportServiceObject(servicesObject);
            }
          }
        }
      },
    };
  },
  meta: {
    docs: {
      description:
        "Module files must source their services from local subfolders, not parent directories",
      recommended: true,
      url: "https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/module-local-imports.md",
    },
    messages: {
      noParentService: [
        "`{{ name }}` is used as a service but imported from a parent directory",
        '("{{ source }}"). Services must come from a subfolder.',
      ].join(" "),
    },
    type: "problem",
  },
};

export default rule;

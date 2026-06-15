/**
 * Require a LoadedModules declaration merge in the same file as
 * CreateApplication/CreateLibrary, positioned after the definition.
 *
 * When a Digital-Alchemy application or library is created via
 * `CreateApplication` or `CreateLibrary`, the same file must contain a
 * `declare module "<source>"` block that re-opens the framework module and
 * contributes an `export interface LoadedModules` entry. The key in that
 * interface must match the `name` property passed to the factory, and the
 * `declare module` block must appear after the factory definition — not before.
 */

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

import type { PluginDocs } from "../lib/types.mts";

type MessageIds = "declareBefore" | "missingDeclare" | "missingLoadedModules" | "nameMismatch";

const FACTORY_NAMES = new Set(["CreateApplication", "CreateLibrary"]);

/**
 * Negative index for `Array.prototype.at` to select the last element.
 *
 * Fixed property of the negative-index addressing: -1 is always the final element.
 */
const LAST_INDEX_OFFSET = -1;

/** True when a `declare module` body statement is the `export interface LoadedModules { ... }` declaration we care about. */
function isLoadedModulesExport(stmt: TSESTree.Statement): boolean {
  return (
    stmt.type === "ExportNamedDeclaration" &&
    stmt.declaration?.type === "TSInterfaceDeclaration" &&
    stmt.declaration.id?.name === "LoadedModules"
  );
}

type CollectResult = {
  loadedModulesKeys: string[];
  loadedModulesNode: TSESTree.TSInterfaceDeclaration | false;
};

/** Collect the `LoadedModules` interface node (when present) and its declared property-key names from a `declare module` body. */
function collectLoadedModules(moduleNode: TSESTree.TSModuleDeclaration): CollectResult {
  const body = moduleNode.body;
  const stmts: TSESTree.Statement[] =
    body?.type === "TSModuleBlock" ? body.body : [];

  const matches = stmts.filter(isLoadedModulesExport);
  const lastMatch = matches.at(LAST_INDEX_OFFSET);

  let loadedModulesNode: TSESTree.TSInterfaceDeclaration | false = false;
  if (
    lastMatch?.type === "ExportNamedDeclaration" &&
    lastMatch.declaration?.type === "TSInterfaceDeclaration"
  ) {
    loadedModulesNode = lastMatch.declaration;
  }

  const loadedModulesKeys: string[] = [];
  for (const stmt of matches) {
    if (
      stmt.type === "ExportNamedDeclaration" &&
      stmt.declaration?.type === "TSInterfaceDeclaration"
    ) {
      for (const member of stmt.declaration.body.body) {
        if (member.type === "TSPropertySignature" && member.key.type === "Identifier") {
          loadedModulesKeys.push(member.key.name);
        }
      }
    }
  }

  return { loadedModulesKeys, loadedModulesNode };
}

/** The literal module name passed as the factory's first-argument `name` property, or "" when absent. */
function moduleNameFromArgs(args: TSESTree.CallExpressionArgument[]): string {
  const [firstArg] = args;
  if (firstArg?.type !== "ObjectExpression") {
    return "";
  }
  const nameProp = firstArg.properties.find(
    p =>
      p.type === "Property" &&
      p.key.type === "Identifier" &&
      p.key.name === "name",
  );
  if (nameProp?.type !== "Property") {
    return "";
  }
  return nameProp.value.type === "Literal" ? String(nameProp.value.value) : "";
}

const rule: TSESLint.RuleModule<MessageIds, [], PluginDocs> = {
  create(context) {
    const factoryImports = new Map<string, { factory: string; source: string }>();
    const moduleCreations: Array<{
      name: string;
      factoryInfo: { factory: string; source: string };
      moduleName: string;
      node: TSESTree.VariableDeclarator;
    }> = [];
    const declareModules: Array<{
      source: string;
      line: number;
      loadedModulesKeys: string[];
      loadedModulesNode: TSESTree.TSInterfaceDeclaration | false;
      node: TSESTree.TSModuleDeclaration;
    }> = [];

    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        const source = node.source?.value;
        if (!source) {
          return;
        }
        for (const spec of node.specifiers) {
          if (
            spec.type === "ImportSpecifier" &&
            spec.imported.type === "Identifier" &&
            FACTORY_NAMES.has(spec.imported.name)
          ) {
            factoryImports.set(spec.local.name, { factory: spec.imported.name, source });
          }
        }
      },

      "Program:exit"() {
        for (const creation of moduleCreations) {
          const { name, factoryInfo, node: creationNode } = creation;
          const expectedSource = factoryInfo.source;
          const matching = declareModules.find(d => d.source === expectedSource);

          if (!matching) {
            context.report({
              data: { factory: factoryInfo.factory, name, source: expectedSource },
              messageId: "missingDeclare",
              node: creationNode,
            });
            continue;
          }

          const hasNameMismatch =
            creation.moduleName && !matching.loadedModulesKeys.includes(creation.moduleName);
          if (!matching.loadedModulesNode) {
            context.report({
              data: { source: expectedSource },
              messageId: "missingLoadedModules",
              node: matching.node,
            });
          } else if (hasNameMismatch) {
            const actual = !matching.loadedModulesKeys?.length
              ? "(none)"
              : matching.loadedModulesKeys.join(", ");
            context.report({
              data: { actual, expected: creation.moduleName },
              messageId: "nameMismatch",
              node: matching.loadedModulesNode,
            });
          }

          const creationLine = creationNode.loc.start.line;
          if (matching.line < creationLine) {
            context.report({
              data: { name },
              messageId: "declareBefore",
              node: matching.node,
            });
          }
        }
      },

      TSModuleDeclaration(node: TSESTree.TSModuleDeclaration) {
        if (node.declare && node.id.type === "Literal") {
          const { loadedModulesKeys, loadedModulesNode } = collectLoadedModules(node);
          declareModules.push({
            line: node.loc.start.line,
            loadedModulesKeys,
            loadedModulesNode,
            node,
            source: String(node.id.value),
          });
        }
      },

      VariableDeclarator(node: TSESTree.VariableDeclarator) {
        if (node.init?.type !== "CallExpression") {
          return;
        }
        const callee = node.init.callee;
        const calleeName = callee.type === "Identifier" ? callee.name : "";
        if (!calleeName || !factoryImports.has(calleeName)) {
          return;
        }

        const moduleName = moduleNameFromArgs(node.init.arguments);

        const idName =
          node.id.type === "Identifier" ? node.id.name : "";

        moduleCreations.push({
          factoryInfo: factoryImports.get(calleeName)!,
          moduleName,
          name: idName,
          node,
        });
      },
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: [
        "Require a LoadedModules declaration merge in the same file as",
        "CreateApplication/CreateLibrary, after the definition",
      ].join(" "),
      recommended: true,
      url: "https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/module-declaration-merge.md",
    },
    messages: {
      declareBefore: "The `declare module` block must appear after the `{{ name }}` definition.",
      missingDeclare: [
        "`{{ name }}` calls `{{ factory }}` but is missing",
        'a `declare module "{{ source }}"` block with a `LoadedModules` interface.',
      ].join(" "),
      missingLoadedModules: [
        'The `declare module "{{ source }}"` block',
        "must contain a `LoadedModules` interface.",
      ].join(" "),
      nameMismatch: [
        "The `LoadedModules` key must match the module's `name` property.",
        "Expected `{{ expected }}` but found `{{ actual }}`.",
      ].join(" "),
    },
    schema: [],
    type: "problem",
  },
};

export default rule;

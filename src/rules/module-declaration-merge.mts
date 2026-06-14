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

import type { Rule } from "eslint";

const FACTORY_NAMES = new Set(["CreateApplication", "CreateLibrary"]);

/**
 * Negative index for `Array.prototype.at` to select the last element.
 *
 * Fixed property of the negative-index addressing: -1 is always the final element.
 */
const LAST_INDEX_OFFSET = -1;

type StmtShape = {
  type: string;
  declaration?: { type: string; id?: { name: string }; body?: { body: MemberShape[] } };
};

type MemberShape = {
  type: string;
  key?: { type: string; name: string };
};

type SpecShape = {
  type: string;
  imported?: { name: string };
  local: { name: string };
};

type PropShape = {
  type: string;
  key: { type: string; name: string };
  value: { type: string; value: unknown };
};

type ObjectArgShape = {
  type: string;
  properties: PropShape[];
};

// True when a `declare module` body statement is the `export interface
// LoadedModules { ... }` declaration we care about.
function isLoadedModulesExport(stmt: StmtShape): boolean {
  return (
    stmt.type === "ExportNamedDeclaration" &&
    stmt.declaration?.type === "TSInterfaceDeclaration" &&
    stmt.declaration.id?.name === "LoadedModules"
  );
}

// Collect the `LoadedModules` interface node (when present) and its declared
// property-key names from a `declare module` body.
function collectLoadedModules(moduleNode: Rule.Node): {
  loadedModulesKeys: string[];
  loadedModulesNode: StmtShape["declaration"];
} {
  const n = moduleNode as unknown as { body?: { body?: StmtShape[] } };
  const matches = (n.body?.body ?? []).filter(stmt => isLoadedModulesExport(stmt));
  const lastMatch = matches.at(LAST_INDEX_OFFSET);
  const loadedModulesNode = lastMatch?.declaration;
  const loadedModulesKeys: string[] = [];

  for (const stmt of matches) {
    for (const member of stmt.declaration?.body?.body ?? []) {
      if (member.type === "TSPropertySignature" && member.key?.type === "Identifier") {
        loadedModulesKeys.push(member.key.name);
      }
    }
  }

  return { loadedModulesKeys, loadedModulesNode };
}

// The literal module name passed as the factory's first-argument `name`
// property, or undefined when absent.
function moduleNameFromArgs(args: unknown[]): string {
  const [firstArg] = args as ObjectArgShape[];
  if (firstArg?.type !== "ObjectExpression") {
    return "";
  }
  const nameProp = firstArg.properties.find(
    p => p.type === "Property" && p.key.type === "Identifier" && p.key.name === "name",
  );
  return nameProp?.value.type === "Literal" ? String(nameProp.value.value) : "";
}

const rule: Rule.RuleModule = {
  create(context) {
    const factoryImports = new Map<string, { factory: string; source: string }>();
    const moduleCreations: Array<{
      name: string;
      factoryInfo: { factory: string; source: string };
      moduleName: string;
      node: Rule.Node;
    }> = [];
    const declareModules: Array<{
      source: string;
      line: number;
      loadedModulesKeys: string[];
      loadedModulesNode: StmtShape["declaration"];
      node: Rule.Node;
    }> = [];

    return {
      ImportDeclaration(node) {
        const n = node as unknown as {
          source?: { value: string };
          specifiers: SpecShape[];
        };
        const source = n.source?.value;
        if (!source) {
          return;
        }
        for (const spec of n.specifiers) {
          if (spec.type === "ImportSpecifier" && spec.imported && FACTORY_NAMES.has(spec.imported.name)) {
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
              node: matching.loadedModulesNode as unknown as Rule.Node,
            });
          }

          const creationLoc = (creationNode as unknown as { loc: { start: { line: number } } }).loc;
          if (matching.line < creationLoc.start.line) {
            context.report({
              data: { name },
              messageId: "declareBefore",
              node: matching.node,
            });
          }
        }
      },

      TSModuleDeclaration(node: Rule.Node) {
        const n = node as unknown as {
          declare?: boolean;
          id?: { type: string; value: string };
          loc: { start: { line: number } };
        };
        if (n.declare && n.id?.type === "Literal") {
          const { loadedModulesKeys, loadedModulesNode } = collectLoadedModules(node);

          declareModules.push({
            line: n.loc.start.line,
            loadedModulesKeys,
            loadedModulesNode,
            node,
            source: n.id.value,
          });
        }
      },

      VariableDeclarator(node) {
        const n = node as unknown as {
          init?: {
            type: string;
            callee: { type: string; name?: string };
            arguments: unknown[];
          };
          id?: { name: string };
        };
        if (n.init?.type !== "CallExpression") {
          return;
        }
        const callee = n.init.callee;
        const calleeName = callee.type === "Identifier" ? callee.name : "";
        if (!calleeName || !factoryImports.has(calleeName)) {
          return;
        }

        const moduleName = moduleNameFromArgs(n.init.arguments);

        moduleCreations.push({
          factoryInfo: factoryImports.get(calleeName)!,
          moduleName,
          name: n.id?.name ?? "",
          node,
        });
      },
    };
  },

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
    type: "problem",
  },
};

export default rule;

/**
 * Enforce that the root body of a `*.service.mts` factory function contains
 * only definitions and wiring — no side-effectful statements.
 *
 * The root statements of the single exported factory (the function that
 * receives `TServiceParams`) are checked. Allowed root statements:
 *
 *   - Variable declarations  (`const x = ...`, `let y`, function declarations)
 *   - The `return` statement
 *   - ExpressionStatement whose callee is `lifecycle.*`
 *     (e.g. `lifecycle.onPreInit(() => { ... })`)
 *   - ExpressionStatement whose callee is an allowlisted framework call
 *     (see `FRAMEWORK_WIRING_CALLS` below)
 *
 * Everything else at root is an error: bare call expressions
 * (`registry.register(...)`, `logger.debug(...)`), IfStatements, loops,
 * try/catch blocks, and any other control flow.
 *
 * Inner closures and returned APIs are NOT checked — only root statements
 * of the factory body.
 *
 * ## Framework-wiring allowlist
 *
 * A small set of DA framework calls are structurally side-effectful but are
 * semantically pure wiring: they internally capture a `lifecycle` hook or
 * coordinate the framework/Fastify boot sequence, making them equivalent to a
 * `lifecycle.*` registration. These calls are explicitly allowlisted so that
 * service factories can use them at root without wrapping them in a redundant
 * `lifecycle.onPreInit`.
 *
 *   - `http.controller(prefix, callback)` — defers route mounting to
 *     `onBootstrap` internally; calling it outside a lifecycle hook is
 *     intentional and documented by the `HttpControllerService` implementation.
 *   - `scheduler.cron(opts)` — registers a recurring cron job with the DA
 *     scheduler; the scheduler itself coordinates lifecycle. Factory-root
 *     registration is the conventional DA pattern.
 *
 * NOT autofixable: relocation of side-effectful code is a semantic decision.
 */

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

import type { PluginDocs } from "../lib/types.mts";

type MessageIds = "noConstructionSideEffects";

/**
 * Negative index passed to `Array.prototype.at` to select the last element.
 *
 * `Array.prototype.at(-1)` returns the final element. Named here to avoid a
 * bare `-1` literal.
 */
const LAST_ELEM = -1;

/** True when `param` is typed as `TServiceParams`. */
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

/** True when `node` is a function expression / arrow that accepts TServiceParams. */
function isServiceFactory(
  node: TSESTree.Node,
): node is TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression {
  if (node.type !== "ArrowFunctionExpression" && node.type !== "FunctionExpression") {
    return false;
  }
  return node.params.some(p => isTServiceParams(p));
}

/** True when `node` is a FunctionDeclaration with a TServiceParams param. */
function isServiceFunctionDecl(node: TSESTree.Node): node is TSESTree.FunctionDeclaration {
  if (node.type !== "FunctionDeclaration") {
    return false;
  }
  return node.params.some(p => isTServiceParams(p));
}

/**
 * Scan a `VariableDeclaration` for a declarator whose initialiser is a service
 * factory function expression. Returns the first matching init node, or false.
 */
function factoryFromVarDecl(
  decl: TSESTree.VariableDeclaration,
): TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression | false {
  for (const d of decl.declarations) {
    if (d.init && isServiceFactory(d.init)) {
      return d.init;
    }
  }
  return false;
}

/**
 * Resolve the factory function node from an `ExportNamedDeclaration`.
 * Handles both function-declaration exports and const-arrow exports.
 */
function factoryFromExport(
  node: TSESTree.ExportNamedDeclaration,
): TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression | false {
  const { declaration } = node;
  if (!declaration) {
    return false;
  }
  if (declaration.type === "FunctionDeclaration") {
    return isServiceFunctionDecl(declaration) ? declaration : false;
  }
  if (declaration.type === "VariableDeclaration") {
    return factoryFromVarDecl(declaration);
  }
  return false;
}

type ServiceFactory =
  | TSESTree.FunctionDeclaration
  | TSESTree.ArrowFunctionExpression
  | TSESTree.FunctionExpression;

/**
 * Resolve the factory function node from a top-level statement.
 * Returns the factory node or false when none is found.
 */
function extractServiceFactory(node: TSESTree.Statement): ServiceFactory | false {
  if (node.type === "ExportNamedDeclaration") {
    return factoryFromExport(node);
  }
  if (isServiceFunctionDecl(node)) {
    return node;
  }
  if (node.type === "VariableDeclaration") {
    return factoryFromVarDecl(node);
  }
  return false;
}

/**
 * Return true when `node` is a `lifecycle.<method>(...)` call expression:
 * callee is a non-computed MemberExpression whose object is an Identifier
 * named `lifecycle`.
 */
function isLifecycleCall(node: TSESTree.Expression): boolean {
  if (node.type !== "CallExpression") {
    return false;
  }
  const { callee } = node;
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "lifecycle"
  );
}

/**
 * Shape of a single entry in the framework-wiring call allowlist.
 *
 * Both fields are exact Identifier names; computed or dynamic member
 * expressions are never allowlisted.
 */
interface FrameworkWiringEntry {
  object: string;
  property: string;
}

/**
 * Allowlisted framework wiring calls that may appear at factory root without
 * being wrapped in a lifecycle hook.
 *
 * Each entry matches a non-computed member-call expression
 * `<object>.<property>(...)` where both sides are plain Identifiers.
 *
 * Rationale for each entry:
 * - `http.controller` — defers route mounting to `onBootstrap` internally;
 *   calling it at construction time is the documented DA/Fastify pattern.
 *   Wrapping it in `lifecycle.onPreInit` is redundant and not required.
 * - `scheduler.cron` — registers a cron job with the DA scheduler, which
 *   itself coordinates lifecycle. Factory-root registration is the
 *   conventional DA scheduler pattern.
 */
const FRAMEWORK_WIRING_CALLS: readonly FrameworkWiringEntry[] = [
  { object: "http", property: "controller" },
  { object: "scheduler", property: "cron" },
];

/**
 * Return true when `node` is a framework wiring call allowlisted for use at
 * factory root (see `FRAMEWORK_WIRING_CALLS`).
 */
function isFrameworkWiringCall(node: TSESTree.Expression): boolean {
  if (node.type !== "CallExpression") {
    return false;
  }
  const { callee } = node;
  if (callee.type !== "MemberExpression" || callee.computed) {
    return false;
  }
  if (callee.object.type !== "Identifier" || callee.property.type !== "Identifier") {
    return false;
  }
  const obj = callee.object.name;
  const prop = callee.property.name;
  return FRAMEWORK_WIRING_CALLS.some(entry => obj === entry.object && prop === entry.property);
}

/**
 * Classify a single root statement of the factory body as allowed or not.
 *
 * Allowed:
 *   - VariableDeclaration (definitions — const, let, function expression inits)
 *   - FunctionDeclaration (named inner function definitions)
 *   - ReturnStatement
 *   - ExpressionStatement whose expression is a lifecycle.* call
 *   - ExpressionStatement whose expression is an allowlisted framework wiring call
 */
function isAllowedRootStatement(node: TSESTree.Statement): boolean {
  switch (node.type) {
    case "VariableDeclaration":
    case "FunctionDeclaration": {
      return true;
    }
    case "ReturnStatement": {
      return true;
    }
    case "ExpressionStatement": {
      return isLifecycleCall(node.expression) || isFrameworkWiringCall(node.expression);
    }
    default: {
      return false;
    }
  }
}

/**
 * Get the body statements of a factory function node.
 */
function getBodyStatements(factoryNode: ServiceFactory): readonly TSESTree.Statement[] {
  const { body } = factoryNode;
  if (body.type !== "BlockStatement") {
    return [];
  }
  return body.body;
}

const rule: TSESLint.RuleModule<MessageIds, [], PluginDocs> = {
  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? "";
    if (!filename.endsWith(".service.mts")) {
      return {};
    }

    return {
      "Program:exit"(program: TSESTree.Program) {
        const factoryNodes: ServiceFactory[] = [];

        for (const stmt of program.body) {
          const factory = extractServiceFactory(stmt);
          if (factory) {
            factoryNodes.push(factory);
          }
        }

        const factoryNode = factoryNodes.at(LAST_ELEM);
        if (factoryNode == undefined) {
          return;
        }

        for (const stmt of getBodyStatements(factoryNode)) {
          if (!isAllowedRootStatement(stmt)) {
            context.report({
              messageId: "noConstructionSideEffects",
              node: stmt,
            });
          }
        }
      },
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: [
        "Disallow side-effectful statements at the root of a service factory.",
        "Construction is for wiring definitions;",
        "side effects belong in lifecycle hooks.",
      ].join(" "),
      recommended: true,
      url: "https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-construction-side-effects.md",
    },
    messages: {
      noConstructionSideEffects: [
        "Construction is for wiring definitions;",
        "side effects belong in lifecycle hooks --",
        "`lifecycle.onPreInit` is early enough.",
      ].join(" "),
    },
    schema: [],
    type: "problem",
  },
};

export default rule;

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

/** Sentinel for "no factory boundary" — passed when checking module-scope hoistability. */
type BoundaryNode = TSESTree.Node | false;

/**
 * True when `node` is a TypeScript type-only wrapper: `as T`, `as const`, or `satisfies T`.
 * These nodes wrap a value without changing it at runtime, so hoistability/staticness
 * analysis must look through them.
 */
function isTypeWrapper(
  node: TSESTree.Node,
): node is TSESTree.TSAsExpression | TSESTree.TSSatisfiesExpression {
  return node.type === "TSAsExpression" || node.type === "TSSatisfiesExpression";
}

/**
 * Strip TypeScript type-only wrapper expressions (`as T`, `as const`,
 * `satisfies T`) to the underlying value node. A type assertion changes no
 * runtime value, so staticness/hoistability analysis must see through it.
 */
function unwrapTypeWrappers(node: TSESTree.Node): TSESTree.Node {
  let current: TSESTree.Node = node;
  while (isTypeWrapper(current)) {
    current = current.expression;
  }
  return current;
}

/**
 * True when `node` is a primitive literal: a string/number/boolean/regex
 * `Literal`, a `TemplateLiteral`, or a negated numeric literal (`-1`). Tagged
 * templates are excluded because the tag may run arbitrary code.
 */
export function isPrimitiveLiteral(node: TSESTree.Node): boolean {
  if (node.type === "Literal") {
    if ("regex" in node && node.regex) {
      return true;
    }
    return ["string", "number", "boolean"].includes(typeof node.value);
  }
  if (node.type === "TemplateLiteral") {
    // Interpolated templates evaluate expressions at runtime — not static.
    return !node.expressions?.length;
  }
  if (node.type === "TaggedTemplateExpression") {
    return false;
  }
  if (node.type === "UnaryExpression" && node.operator === "-") {
    const { argument } = node;
    if (argument.type === "Literal") {
      return typeof argument.value === "number" && !Number.isNaN(argument.value);
    }
  }
  return false;
}

/**
 * True when `node` is a static collection literal: `new Set([...])` or
 * `new Map([...])` whose sole argument is an array literal of static values.
 */
export function isStaticCollectionLiteral(node: TSESTree.Node): boolean {
  if (node.type !== "NewExpression") {
    return false;
  }
  const { callee, arguments: args } = node;
  if (callee.type !== "Identifier") {
    return false;
  }
  if (!["Set", "Map"].includes(callee.name)) {
    return false;
  }
  // Must have exactly one argument (the seed array)
  const [firstArg, ...extraArgs] = args;
  if (extraArgs?.length) {
    return false;
  }
  if (!firstArg || firstArg.type !== "ArrayExpression") {
    return false;
  }
  return firstArg.elements.every(el => el && isStaticValue(el));
}

/**
 * A single recursive predicate: a node is a "static value" iff it is a
 * primitive literal, a static `new Set/Map([...])` collection, a static
 * object literal, a static array literal, or a static binary expression.
 *
 * This is what makes object/array statics FULLY RECURSIVE: a nested object
 * or array is accepted only when its own contents are themselves static
 * values. A value that references an identifier or a call is NONE of these,
 * so it is correctly treated as non-static.
 */
export function isStaticValue(node: TSESTree.Node): boolean {
  const n = unwrapTypeWrappers(node);
  return (
    isPrimitiveLiteral(n) ||
    isStaticCollectionLiteral(n) ||
    isStaticObjectLiteral(n) ||
    isStaticArrayLiteral(n) ||
    isStaticBinary(n)
  );
}

/**
 * True when `node` is a non-empty object literal whose every property is a
 * plain (non-computed, non-spread) key mapping to a static value.
 */
export function isStaticObjectLiteral(node: TSESTree.Node): boolean {
  if (node.type !== "ObjectExpression") {
    return false;
  }
  if (!node.properties?.length) {
    return false;
  }
  return node.properties.every(prop => {
    if (prop.type !== "Property") {
      return false;
    } // no spread elements
    if (prop.computed) {
      return false;
    } // no computed keys
    return isStaticValue(prop.value);
  });
}

/**
 * `const X = ["a", "b", 1, 2]` -- plain array literal whose elements are
 * all static values. Recursion through `isStaticValue` handles nested
 * arrays and objects of literals (e.g. `[["a", 1], ["b", 2]]` and
 * `[{ k: "a", v: 1 }]`), to any depth.
 *
 * Holes (missing elements), spread elements, and dynamic expressions
 * disqualify the array -- it is no longer "static" if its contents depend
 * on identifiers in scope. (`isStaticValue` returns false for a missing
 * element, a SpreadElement, an Identifier, or a CallExpression.)
 */
export function isStaticArrayLiteral(node: TSESTree.Node): boolean {
  if (node.type !== "ArrayExpression") {
    return false;
  }
  if (!node.elements?.length) {
    return false;
  }
  return node.elements.every(el => el && isStaticValue(el));
}

export const STATIC_BINARY_OPERATORS = new Set(["+", "-", "*", "/", "%", "**"]);

/**
 * A constant arithmetic expression whose operands are themselves static --
 * e.g. `1024 * 1024`, `60 * 60 * 1000`. These read as hard-coded magic
 * numbers with no dependency on anything in scope.
 */
export function isStaticBinary(node: TSESTree.Node): boolean {
  if (node.type !== "BinaryExpression") {
    return false;
  }
  if (!STATIC_BINARY_OPERATORS.has(node.operator)) {
    return false;
  }
  return isStaticValue(node.left) && isStaticValue(node.right);
}

/**
 * Pure, non-mutating array/string methods that produce a hoistable result
 * when called on a hoistable receiver with hoistable arguments.
 */
const PURE_METHODS = new Set([
  "join",
  "concat",
  "slice",
  "repeat",
  "padStart",
  "padEnd",
  "toUpperCase",
  "toLowerCase",
  "trim",
  "split",
  "flat",
  "at",
]);

/**
 * A `TemplateLiteral` is hoistable when it has no interpolations, or when every
 * interpolated expression is itself hoistable.
 */
function isHoistableTemplate(
  node: TSESTree.TemplateLiteral,
  sourceCode: TSESLint.SourceCode,
  boundaryNode: BoundaryNode,
): boolean {
  if (!node.expressions?.length) {
    return true;
  }
  return node.expressions.every(expr => isHoistableStatic(expr, sourceCode, boundaryNode));
}

/**
 * A `CallExpression` is hoistable only as `hoistableReceiver.pureMethod(args)`
 * where the receiver and every argument are themselves hoistable.
 */
function isHoistableCall(
  node: TSESTree.CallExpression,
  sourceCode: TSESLint.SourceCode,
  boundaryNode: BoundaryNode,
): boolean {
  const { callee, arguments: args } = node;
  if (callee.type !== "MemberExpression" || callee.computed) {
    return false;
  }
  if (callee.property.type !== "Identifier") {
    return false;
  }
  const methodName = callee.property.name;
  if (!PURE_METHODS.has(methodName)) {
    return false;
  }
  if (!isHoistableStatic(callee.object, sourceCode, boundaryNode)) {
    return false;
  }
  return args.every(arg => isHoistableStatic(arg, sourceCode, boundaryNode));
}

/**
 * A `BinaryExpression` is hoistable when its operator is a static-arithmetic
 * operator and both operands are hoistable (extends {@link isStaticBinary} to
 * allow identifier operands).
 */
function isHoistableBinary(
  node: TSESTree.BinaryExpression,
  sourceCode: TSESLint.SourceCode,
  boundaryNode: BoundaryNode,
): boolean {
  if (!STATIC_BINARY_OPERATORS.has(node.operator)) {
    return false;
  }
  return (
    isHoistableStatic(node.left, sourceCode, boundaryNode) &&
    isHoistableStatic(node.right, sourceCode, boundaryNode)
  );
}

/**
 * True when `node` is safe to hoist out of a service factory: a static value,
 * or a pure expression (member access, call, binary op, template) over operands
 * that are themselves hoistable and resolve outside `boundaryNode`'s scope.
 *
 * Pass `false` for `boundaryNode` when there is no factory boundary (module scope):
 * any resolved binding is then treated as hoistable.
 */
export function isHoistableStatic(
  node: TSESTree.Node,
  sourceCode: TSESLint.SourceCode,
  boundaryNode: BoundaryNode,
): boolean {
  const n = unwrapTypeWrappers(node);
  if (!n) {
    return false;
  }
  // TemplateLiteral is handled first: its interpolations must each be checked,
  // so it must not be short-circuited by the purely-syntactic base case (which
  // would treat any template as a primitive literal).
  if (n.type === "TemplateLiteral") {
    return isHoistableTemplate(n, sourceCode, boundaryNode);
  }
  // Purely-syntactic base cases (no identifier references inside).
  if (isStaticValue(n)) {
    return true;
  }
  switch (n.type) {
    case "BinaryExpression":
      return isHoistableBinary(n, sourceCode, boundaryNode);
    case "CallExpression":
      return isHoistableCall(n, sourceCode, boundaryNode);
    case "Identifier":
      return _isHoistableIdentifier(n, sourceCode, boundaryNode);
    default:
      return false;
  }
}

/**
 * True when `def`'s node range is fully contained within `boundaryNode`'s
 * range — i.e. the binding is declared inside the factory boundary and is
 * therefore factory-local, not hoistable.
 */
function isDefInsideBoundary(
  def: TSESLint.Scope.Definition,
  boundaryNode: TSESTree.Node,
): boolean {
  const defRange = def.node.range;
  const bRange = boundaryNode.range;
  return Boolean(defRange && bRange && defRange[0] >= bRange[0] && defRange[1] <= bRange[1]);
}

/**
 * Classify a resolved scope reference as hoistable. An unresolved binding is
 * not hoistable; a binding with no defs is a global/built-in and is hoistable;
 * otherwise it is hoistable unless one of its defs sits inside `boundaryNode`.
 */
function isHoistableReference(
  ref: TSESLint.Scope.Reference,
  boundaryNode: BoundaryNode,
): boolean {
  const variable = ref.resolved;
  if (!variable) {
    // Unresolved reference — conservatively treat as not hoistable.
    return false;
  }
  if (!variable.defs?.length) {
    // No defs: global or built-in binding — always hoistable.
    return true;
  }
  if (boundaryNode && variable.defs.some(def => isDefInsideBoundary(def, boundaryNode))) {
    // At least one def lives inside the factory boundary — factory-local, not hoistable.
    return false;
  }
  return true;
}

/**
 * Internal: determine whether an Identifier refers to a binding that is NOT
 * defined inside `boundaryNode` (module-scope, imported, global → hoistable).
 */
function _isHoistableIdentifier(
  node: TSESTree.Identifier,
  sourceCode: TSESLint.SourceCode,
  boundaryNode: BoundaryNode,
): boolean {
  let scope = sourceCode.getScope(node);
  while (scope) {
    for (const ref of scope.references) {
      // Identity comparison: ref.identifier IS the same node object at runtime.
      if (ref.identifier !== node) {
        continue;
      }
      return isHoistableReference(ref, boundaryNode);
    }
    if (!scope.upper) {
      break;
    }
    scope = scope.upper;
  }
  return false;
}

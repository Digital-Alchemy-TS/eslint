import type { TSESTree } from "@typescript-eslint/utils";

/**
 * Structural shape for generic AST traversal. The concrete `TSESTree.Node`
 * union cannot be indexed by an arbitrary string key, so walkers that recurse
 * via `Object.keys(node)` operate on this open-keyed shape instead.
 */
export interface AstNodeLike {
  type: string;
  [key: string]: unknown;
}

/**
 * Type guard for a value that structurally looks like an AST node, i.e. a
 * defined object carrying a string `type` discriminant. Lets generic walkers
 * narrow `unknown` children (e.g. the elements of an array branch) without
 * a cast.
 */
export function isAstNode(value: unknown): value is AstNodeLike {
  return (
    value != undefined &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string"
  );
}

/**
 * Returns the string name of an ObjectExpression property key, or undefined for
 * computed / spread keys that can't be statically resolved.
 */
export function getPropName(prop: TSESTree.Property | TSESTree.SpreadElement): string {
  if (prop.type !== "Property") {
    return undefined;
  }
  if (prop.key.type === "Identifier") {
    return prop.key.name;
  }
  if (prop.key.type === "Literal") {
    return String(prop.key.value);
  }
  return undefined;
}

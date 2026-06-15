/**
 * Shared ESTree extraction for the three `priorityInit` rules.
 *
 * Each rule visits a `CreateLibrary`/`CreateApplication` call in a `.module.mts`
 * file and needs the same three facts off that call's config object: the module
 * `name:`, the ordered `services` keys, and the `priorityInit` entries paired
 * with their ESTree nodes (so reports land on the offending string element).
 * The cross-file `constructionReads` come separately from {@link getModuleIndex}.
 */

import type { TSESTree } from "@typescript-eslint/utils";

import { getPropName } from "./utils.mts";

const FACTORIES = ["CreateLibrary", "CreateApplication"];

/** One `priorityInit` entry: its service key and the array element node to report on. */
export interface PriorityElement {
  readonly key: string;
  readonly node: TSESTree.Node;
}

/** The facts a priorityInit rule reads from one module-declaration call. */
export interface ModuleCallFacts {
  readonly name: string;
  /** The const the call is assigned to (e.g. `LIB_DB`), for per-declaration lookup. */
  readonly constName: string;
  readonly configNode: TSESTree.ObjectExpression;
  readonly serviceKeys: string[];
  readonly priorityInit: PriorityElement[];
  /** The `priorityInit` array node, when present (else the call's config object). */
  readonly priorityNode: TSESTree.Node;
}

/** Find an own property of an object expression by key name. */
function findProp(object: TSESTree.ObjectExpression, name: string): TSESTree.Property {
  for (const property of object.properties) {
    if (property.type === "Property" && getPropName(property) === name) {
      return property;
    }
  }
  return undefined;
}

/** The string value of a `name:`-style property, or undefined. */
function stringProp(object: TSESTree.ObjectExpression, name: string): string {
  const property = findProp(object, name);
  if (property?.value.type === "Literal" && typeof property.value.value === "string") {
    return property.value.value;
  }
  return undefined;
}

/** Service keys in `services` declaration order. */
function serviceKeyOrder(object: TSESTree.ObjectExpression): string[] {
  const services = findProp(object, "services");
  if (services?.value.type !== "ObjectExpression") {
    return [];
  }
  const keys: string[] = [];
  for (const property of services.value.properties) {
    if (property.type === "Property") {
      const key = getPropName(property);
      if (key) {
        keys.push(key);
      }
    }
  }
  return keys;
}

/** `priorityInit` string entries paired with their element nodes. */
function priorityElements(object: TSESTree.ObjectExpression): PriorityElement[] {
  const priority = findProp(object, "priorityInit");
  if (priority?.value.type !== "ArrayExpression") {
    return [];
  }
  const elements: PriorityElement[] = [];
  for (const element of priority.value.elements) {
    if (element?.type === "Literal" && typeof element.value === "string") {
      elements.push({ key: element.value, node: element });
    }
  }
  return elements;
}

/** Parse a `CreateLibrary`/`CreateApplication` call, or return undefined when it is neither. */
export function moduleCallFacts(node: TSESTree.CallExpression): ModuleCallFacts {
  if (node.callee.type !== "Identifier" || !FACTORIES.includes(node.callee.name)) {
    return undefined;
  }
  const [arg] = node.arguments;
  if (arg?.type !== "ObjectExpression") {
    return undefined;
  }
  const name = stringProp(arg, "name");
  if (!name) {
    return undefined;
  }
  const parent = node.parent;
  const constName =
    parent?.type === "VariableDeclarator" && parent.id.type === "Identifier" ? parent.id.name : "";
  const priority = findProp(arg, "priorityInit");
  return {
    configNode: arg,
    constName,
    name,
    priorityInit: priorityElements(arg),
    priorityNode: priority?.value ?? arg,
    serviceKeys: serviceKeyOrder(arg),
  };
}

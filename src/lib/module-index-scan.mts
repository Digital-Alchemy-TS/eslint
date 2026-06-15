/**
 * AST scanning pass for the module-index.
 *
 * Extracts: function-like bindings, barrel arrays, and module-factory calls from
 * every non-declaration source file in a `ts.Program`. The collected facts are
 * consumed by the second pass in `module-index.mts` to build the full
 * `ModuleIndex`.
 *
 * All symbols here are internal to the module-index subsystem; only the types
 * and functions that `module-index.mts` needs are exported.
 */

import ts from "typescript";

/** Filename suffixes marking a DA module/application source file. */
const MODULE_SUFFIXES = [".module.mts", ".app.mts"];

/**
 * Thrown when the scanner encounters a second exported factory function with a
 * name already indexed from a different file. The scanner uses first-seen-wins
 * semantics, so a silent collision would cause it to analyze the wrong factory
 * body and emit false verdicts. Renaming one of the factories is the fix.
 *
 * @throws {DuplicateFactoryNameError} On duplicate exported factory function name
 */
export class DuplicateFactoryNameError extends Error {
  constructor(name: string, firstFile: string, secondFile: string) {
    super(
      `module-index-scan: duplicate exported factory name "${name}" -- ` +
        `first seen in "${firstFile}", also found in "${secondFile}". ` +
        `Rename one of them; the scanner cannot distinguish which factory body belongs to which module registration.`,
    );
    this.name = "DuplicateFactoryNameError";
  }
}

/** Map a factory callee name to the DA module kind it declares, or undefined. */
function factoryKind(callee: string): "application" | "library" {
  if (callee === "CreateLibrary") {
    return "library";
  }
  if (callee === "CreateApplication") {
    return "application";
  }
  return undefined;
}

/** One registered service: its key in `services` and the factory it binds. */
export interface ServiceEntry {
  readonly key: string;
  readonly fnName: string;
}

/** One discovered module declaration awaiting second-pass resolution. */
export interface ModuleCandidate {
  readonly constName: string;
  readonly config: ts.ObjectLiteralExpression;
  readonly file: string;
  readonly id: string;
  readonly kind: "application" | "library";
}

/** One indexed factory function entry: the AST node and the file it came from. */
export interface FunctionEntry {
  readonly fn: ts.FunctionLikeDeclarationBase;
  readonly file: string;
}

/** A recorded name collision: both file paths that exported the same factory name. */
export interface DuplicateEntry {
  readonly firstFile: string;
  readonly secondFile: string;
}

/** First-pass collections gathered in a single walk of every source file. */
export interface Collected {
  readonly functions: Map<string, FunctionEntry>;
  /**
   * Names that collided across files: name -> { firstFile, secondFile }.
   * Populated instead of throwing eagerly so callers can decide whether the
   * collision is relevant (only collisions on names actually used as service
   * factories are hard errors).
   */
  readonly duplicates: Map<string, DuplicateEntry>;
  readonly barrels: Map<string, ts.ArrayLiteralExpression>;
  readonly modules: ModuleCandidate[];
}

/** Whether a TS node introduces its own function scope. */
function isFunctionLike(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

/** The static name of an object-literal property/binding, or undefined. */
function propName(name: ts.PropertyName | ts.BindingName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}

/** Find a property assignment by name on an object literal. */
function getProp(object: ts.ObjectLiteralExpression, name: string): ts.PropertyAssignment {
  for (const property of object.properties) {
    if (ts.isPropertyAssignment(property) && propName(property.name) === name) {
      return property;
    }
  }
  return undefined;
}

/** The `CreateLibrary`/`CreateApplication` config object of a declaration, with its kind. */
function moduleCall(declaration: ts.VariableDeclaration) {
  const call = declaration.initializer;
  if (!call || !ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) {
    return undefined;
  }
  const kind = factoryKind(call.expression.text);
  const [firstArg] = call.arguments;
  if (!kind || !firstArg || !ts.isObjectLiteralExpression(firstArg)) {
    return undefined;
  }
  return { config: firstArg, kind } as const;
}

/** Read `services: { key: Factory }` into ordered entries. */
export function serviceEntries(config: ts.ObjectLiteralExpression): ServiceEntry[] {
  const services = getProp(config, "services");
  if (!services || !ts.isObjectLiteralExpression(services.initializer)) {
    return [];
  }
  const entries: ServiceEntry[] = [];
  for (const property of services.initializer.properties) {
    if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.initializer)) {
      const key = propName(property.name);
      if (key) {
        entries.push({ fnName: property.initializer.text, key });
      }
    } else if (ts.isShorthandPropertyAssignment(property)) {
      entries.push({ fnName: property.name.text, key: property.name.text });
    }
  }
  return entries;
}

/** Read `priorityInit: [...]` string keys in listed order. */
export function priorityKeys(config: ts.ObjectLiteralExpression): string[] {
  const priority = getProp(config, "priorityInit");
  if (!priority || !ts.isArrayLiteralExpression(priority.initializer)) {
    return [];
  }
  const keys: string[] = [];
  for (const element of priority.initializer.elements) {
    if (ts.isStringLiteralLike(element)) {
      keys.push(element.text);
    }
  }
  return keys;
}

/** Read the `name:` string literal off a module config object. */
function getStringName(config: ts.ObjectLiteralExpression): string {
  const name = getProp(config, "name");
  if (name && ts.isStringLiteralLike(name.initializer)) {
    return name.initializer.text;
  }
  return undefined;
}

/**
 * Record a function-like node by its bound name.
 *
 * When the name is already indexed from a different file the collision is
 * recorded in `collected.duplicates` rather than thrown immediately. The error
 * is deferred to the module-index assembly step, where it can be raised only
 * for names that are actually referenced as service factories -- this avoids
 * false positives from test-helper functions that share a name across test files
 * but are never registered in any module.
 */
function recordFunction(
  collected: Collected,
  name: string,
  fn: ts.FunctionLikeDeclarationBase,
  file: string,
): void {
  if (!name) {
    return;
  }
  const existing = collected.functions.get(name);
  if (existing) {
    if (!collected.duplicates.has(name)) {
      collected.duplicates.set(name, { firstFile: existing.file, secondFile: file });
    }
    return;
  }
  collected.functions.set(name, { file, fn });
}

/** Classify a `const X = ...` declaration as a factory, barrel, or module. */
function classifyDeclaration(
  node: ts.VariableDeclaration,
  collected: Collected,
  file: string,
  isModuleFile: boolean,
): void {
  const name = (node.name as ts.Identifier).text;
  const init = node.initializer;
  if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
    recordFunction(collected, name, init, file);
    return;
  }
  if (init && ts.isArrayLiteralExpression(init)) {
    collected.barrels.set(name, init);
    return;
  }
  if (!isModuleFile) {
    return;
  }
  const found = moduleCall(node);
  const id = found && getStringName(found.config);
  if (found && id) {
    collected.modules.push({ config: found.config, constName: name, file, id, kind: found.kind });
  }
}

/** Catalogue functions, barrels, and module declarations across one file. */
export function collectFile(sourceFile: ts.SourceFile, collected: Collected): void {
  const isModuleFile = MODULE_SUFFIXES.some(suffix => sourceFile.fileName.endsWith(suffix));
  // Visit only the shallow declaration layer. Recursion stops at function-like
  // nodes so that nested helper functions (local to a service factory body)
  // are never indexed as module-level factory names.
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      recordFunction(collected, node.name.text, node, sourceFile.fileName);
      // Do not recurse into the function body -- nested declarations are not
      // module-level factories.
      return;
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      classifyDeclaration(node, collected, sourceFile.fileName, isModuleFile);
      // Do not recurse into the variable initializer -- a const arrow-function's
      // body may contain local nested functions that must not be indexed.
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
}

/** Resolve a `depends:`/`libraries:` array to internal module ids, expanding barrels. */
export function resolveDeps(
  config: ts.ObjectLiteralExpression,
  collected: Collected,
  nodeByConst: Map<string, string>,
): Set<string> {
  const out = new Set<string>();
  const array = getProp(config, "depends") ?? getProp(config, "libraries");
  if (!array || !ts.isArrayLiteralExpression(array.initializer)) {
    return out;
  }
  const visited = new Set<string>();
  const walk = (list: ts.ArrayLiteralExpression): void => {
    for (const element of list.elements) {
      const inner = ts.isSpreadElement(element) ? element.expression : element;
      if (ts.isArrayLiteralExpression(inner)) {
        walk(inner);
        continue;
      }
      if (!ts.isIdentifier(inner)) {
        continue;
      }
      const name = inner.text;
      const id = nodeByConst.get(name);
      if (id) {
        out.add(id);
        continue;
      }
      const barrel = collected.barrels.get(name);
      if (barrel && !visited.has(name)) {
        visited.add(name);
        walk(barrel);
      }
    }
  };
  walk(array.initializer);
  return out;
}

/** True when `node`'s nearest enclosing function is `factory` itself (no nested fn between). */
function enclosingIsFactory(node: ts.Node, factory: ts.Node): boolean {
  let current = node.parent;
  while (current) {
    if (current === factory) {
      return true;
    }
    if (isFunctionLike(current)) {
      return false;
    }
    current = current.parent;
  }
  return false;
}

/**
 * True when identifier `id` resolves to a binding declared inside `factory`
 * (i.e. the destructured `TServiceParams` inject), not a module-level local
 * that merely shares the module's name. Falls back to accepting when no type
 * info or symbol is available.
 */
function receiverIsInject(id: ts.Identifier, factory: ts.Node, checker: ts.TypeChecker): boolean {
  if (!checker) {
    return true;
  }
  const symbol = checker.getSymbolAtLocation(id);
  const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
  if (!declaration) {
    return true;
  }
  return declaration.getStart() >= factory.getStart() && declaration.getEnd() <= factory.getEnd();
}

/** Context threaded through a factory-body construction-read walk. */
interface ReadScan {
  readonly factory: ts.FunctionLikeDeclarationBase;
  readonly moduleName: string;
  readonly validKeys: Set<string>;
  readonly checker: ts.TypeChecker;
  readonly found: Set<string>;
}

/** A top-level `<module>.<key>` read of a sibling service's API. */
function isModuleAccess(node: ts.Node, scan: ReadScan): node is ts.PropertyAccessExpression {
  if (!ts.isPropertyAccessExpression(node) || !ts.isIdentifier(node.expression)) {
    return false;
  }
  const matches = node.expression.text === scan.moduleName && scan.validKeys.has(node.name.text);
  return (
    matches &&
    enclosingIsFactory(node, scan.factory) &&
    receiverIsInject(node.expression, scan.factory, scan.checker)
  );
}

/** A top-level `const { key } = <module>` destructure of sibling service APIs. */
function isModuleDestructure(node: ts.Node, scan: ReadScan): node is ts.VariableDeclaration {
  if (!ts.isVariableDeclaration(node) || !node.initializer || !ts.isIdentifier(node.initializer)) {
    return false;
  }
  const matches = node.initializer.text === scan.moduleName && ts.isObjectBindingPattern(node.name);
  return (
    matches &&
    enclosingIsFactory(node, scan.factory) &&
    receiverIsInject(node.initializer, scan.factory, scan.checker)
  );
}

/** Sibling keys a factory reads at construction time, via access or destructure. */
export function constructionReadKeys(
  factory: ts.FunctionLikeDeclarationBase,
  moduleName: string,
  validKeys: Set<string>,
  checker: ts.TypeChecker,
): Set<string> {
  const scan: ReadScan = { checker, factory, found: new Set<string>(), moduleName, validKeys };
  if (!factory.body) {
    return scan.found;
  }
  const visit = (node: ts.Node): void => {
    if (isModuleAccess(node, scan)) {
      scan.found.add(node.name.text);
    }
    if (isModuleDestructure(node, scan) && ts.isObjectBindingPattern(node.name)) {
      for (const element of node.name.elements) {
        const key = propName(element.propertyName ?? element.name);
        if (key && validKeys.has(key)) {
          scan.found.add(key);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(factory.body, visit);
  return scan.found;
}

/**
 * Program-wide Digital-Alchemy module index.
 *
 * Builds — once per `ts.Program`, cached in a `WeakMap` — the cross-file facts
 * the module-wiring rules need but cannot see from a single file: which module
 * owns each service factory, what each module declares in `depends:` /
 * `libraries:` (barrel spreads expanded), and which sibling service keys a
 * factory reads at *construction* time.
 *
 * This is the raw-`typescript` analogue of the `bin/module-graph` POC's
 * ts-morph `buildModuleScan`, and mirrors `throws-boundary-index.mts`: walk
 * `program.getSourceFiles()` lazily and memoize by program identity. The
 * consuming rules match by name/string against this index and report on their
 * own file's ESTree nodes, so reporting stays where ESLint requires it.
 *
 * @remarks
 * Editor watch-mode limitation: typescript-eslint mutates the same `ts.Program`
 * object in place across edits, so a `WeakMap<ts.Program>` returns a stale index
 * after a module/service is added or renamed mid-session — the same posture as
 * `throws-boundary-index.mts`. The CLI `yarn lint` gate rebuilds a fresh program
 * each run, so CI is unaffected; the editor catches up on the next program swap.
 */

import type ts from "typescript";

import type { Collected, ServiceEntry } from "./module-index-scan.mts";
import {
  collectFile,
  constructionReadKeys,
  DuplicateFactoryNameError,
  priorityKeys,
  resolveDeps,
  serviceEntries,
} from "./module-index-scan.mts";

/** Per-module facts derived from one `CreateLibrary`/`CreateApplication` call. */
export interface ModuleEntry {
  readonly id: string;
  readonly kind: "application" | "library";
  /** Absolute source file of the declaration. */
  readonly file: string;
  /** The const the factory result is bound to (e.g. `LIB_DB`). */
  readonly constName: string;
  /** Service keys in `services` declaration order. */
  readonly serviceKeys: string[];
  /** Service keys listed in `priorityInit`, in listed order. */
  readonly priorityInit: string[];
  /** Module ids this module declares as dependencies (barrels expanded). */
  readonly declaredDeps: Set<string>;
  /** consumerKey -> sibling keys it reads at construction time. */
  readonly constructionReads: Map<string, Set<string>>;
}

/**
 * Stable per-declaration key. Module `name:` is NOT unique — test files
 * legitimately re-declare a module under the same name to mock it — so entries
 * are keyed by source file + const name, never by name alone. Keying by name
 * would collapse a mock and the real module into one entry and cross-pollute
 * their construction reads.
 */
export function declKey(file: string, constName: string): string {
  return `${file}#${constName}`;
}

/** The whole-program index consumed by the module-wiring rules. */
export interface ModuleIndex {
  /** Every module id (`name:` value) discovered in the program. */
  readonly moduleIds: Set<string>;
  /** Service-factory function name -> the module entry that registers it. */
  readonly serviceOwners: Map<string, ModuleEntry>;
  /** declKey(file, constName) -> its derived facts. */
  readonly byDecl: Map<string, ModuleEntry>;
}

/**
 * Per-program cache. Populated lazily on the first `getModuleIndex` call for a
 * given program (mirrors `throws-boundary-index.mts`).
 */
let CACHE = new WeakMap<ts.Program, ModuleIndex>();

/**
 * Build the per-service-entry construction-reads map for one module.
 *
 * @throws {DuplicateFactoryNameError} When a service's factory name collides across source files.
 */
function buildConstructionReads(
  entries: ServiceEntry[],
  collected: Collected,
  moduleName: string,
  validKeys: Set<string>,
  checker: ts.TypeChecker,
): Map<string, Set<string>> {
  const constructionReads = new Map<string, Set<string>>();
  for (const entry of entries) {
    const duplicate = collected.duplicates.get(entry.fnName);
    if (duplicate) {
      // A service factory name that collides across files is a hard error:
      // the scanner cannot tell which factory body belongs to this module
      // registration, so continuing would produce silently wrong analysis.
      throw new DuplicateFactoryNameError(entry.fnName, duplicate.firstFile, duplicate.secondFile);
    }
    const functionEntry = collected.functions.get(entry.fnName);
    if (functionEntry) {
      constructionReads.set(
        entry.key,
        constructionReadKeys(functionEntry.fn, moduleName, validKeys, checker),
      );
    }
  }
  return constructionReads;
}

/**
 * Build (or return from cache) the whole-program module index.
 *
 * @throws {DuplicateFactoryNameError} When two source files export a factory function
 * with the same name that is referenced as a service in a module registration.
 */
export function getModuleIndex(program: ts.Program, checker: ts.TypeChecker): ModuleIndex {
  const cached = CACHE.get(program);
  if (cached) {
    return cached;
  }

  const collected: Collected = {
    barrels: new Map(),
    duplicates: new Map(),
    functions: new Map(),
    modules: [],
  };
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile || sourceFile.fileName.includes("node_modules")) {
      continue;
    }
    collectFile(sourceFile, collected);
  }

  const nodeByConst = new Map<string, string>();
  for (const module of collected.modules) {
    nodeByConst.set(module.constName, module.id);
  }

  const moduleIds = new Set<string>();
  const serviceOwners = new Map<string, ModuleEntry>();
  const byDecl = new Map<string, ModuleEntry>();

  for (const module of collected.modules) {
    const entries = serviceEntries(module.config);
    const serviceKeys = entries.map(entry => entry.key);
    const validKeys = new Set(serviceKeys);
    const constructionReads = buildConstructionReads(
      entries,
      collected,
      module.id,
      validKeys,
      checker,
    );
    const moduleEntry: ModuleEntry = {
      constName: module.constName,
      constructionReads,
      declaredDeps: resolveDeps(module.config, collected, nodeByConst),
      file: module.file,
      id: module.id,
      kind: module.kind,
      priorityInit: priorityKeys(module.config),
      serviceKeys,
    };
    moduleIds.add(module.id);
    byDecl.set(declKey(module.file, module.constName), moduleEntry);
    for (const entry of entries) {
      serviceOwners.set(entry.fnName, moduleEntry);
    }
  }

  const index: ModuleIndex = { byDecl, moduleIds, serviceOwners };
  CACHE.set(program, index);
  return index;
}

/** The module declared at `file`'s `constName`, or undefined. */
export function moduleAtDecl(index: ModuleIndex, file: string, constName: string): ModuleEntry {
  if (!constName) {
    return undefined;
  }
  return index.byDecl.get(declKey(file, constName));
}

/** Service keys that at least one *other* sibling construction-reads. */
export function consumedKeys(constructionReads: Map<string, Set<string>>): Set<string> {
  const consumed = new Set<string>();
  for (const [consumerKey, producers] of constructionReads) {
    for (const producerKey of producers) {
      if (producerKey !== consumerKey) {
        consumed.add(producerKey);
      }
    }
  }
  return consumed;
}

/** Final wire sequence: priorityInit keys first (in order), then the rest in declaration order. */
export function wireIndex(serviceKeys: string[], priorityInit: string[]): Map<string, number> {
  const remaining = serviceKeys.filter(key => !priorityInit.includes(key));
  const sequence = [...priorityInit, ...remaining];
  return new Map(sequence.map((key, index): [string, number] => [key, index]));
}

/** The parser-services shape this module reads off an ESLint source/context. */
interface ParserServicesLike {
  program?: ts.Program;
}

/** Minimal ESLint source-code shape carrying parser services. */
interface SourceCodeLike {
  parserServices?: ParserServicesLike;
}

/** Minimal ESLint rule-context shape this module reads. */
interface RuleContextLike {
  sourceCode?: SourceCodeLike;
  parserServices?: ParserServicesLike;
  getSourceCode?: () => SourceCodeLike;
}

/** Acquire the TS program + checker from an ESLint rule context, when type info is available. */
export function programFromContext(context: RuleContextLike) {
  const sourceCode = context.sourceCode ?? context.getSourceCode?.();
  const services = sourceCode?.parserServices ?? context.parserServices;
  if (!services?.program) {
    return undefined;
  }
  return { checker: services.program.getTypeChecker(), program: services.program };
}

/** Clear the per-program cache. Used by RuleTester suites exercising multiple fixtures. */
export function _resetModuleIndexForTests(): void {
  CACHE = new WeakMap<ts.Program, ModuleIndex>();
}

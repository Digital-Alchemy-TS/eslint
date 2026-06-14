import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "./no-service-module-scope-state.mts";

const tester = new RuleTester({
  languageOptions: { parser: tsParser },
});

describe("no-service-module-scope-state", () => {
  it("allows static primitive consts at module scope in a .service.mts file", () => {
    tester.run("digital-alchemy/no-service-module-scope-state", rule, {
      invalid: [],
      valid: [
        { code: `const FIELD_SEP = "";`, filename: "x.service.mts" },
        { code: `const FIELD_COUNT = 10;`, filename: "x.service.mts" },
        { code: `const MAX_BUFFER_BYTES = 10_485_760;`, filename: "x.service.mts" },
        { code: `const FORMAT = ["#{pane_id}", "#{pane_pid}"];`, filename: "x.service.mts" },
        { code: `const MAX = 1024 * 1024;`, filename: "x.service.mts" },
        { code: `const SEED = new Map([["a", 1]]);`, filename: "x.service.mts" },
      ],
    });
  });

  it("allows any form in a non-.service.mts file (gate)", () => {
    tester.run("digital-alchemy/no-service-module-scope-state", rule, {
      invalid: [],
      valid: [
        { code: `let counter = 0;`, filename: "x.mts" },
        { code: `var x = 1;`, filename: "x.mts" },
        { code: `const cache = new Map();`, filename: "x.mts" },
        { code: `export const store = new Set();`, filename: "x.mts" },
      ],
    });
  });

  it("flags let at module scope in a .service.mts file", () => {
    tester.run("digital-alchemy/no-service-module-scope-state", rule, {
      invalid: [
        {
          code: `let counter = 0;`,
          errors: [{ messageId: "noModuleScopeState" }],
          filename: "x.service.mts",
        },
      ],
      valid: [],
    });
  });

  it("flags var at module scope in a .service.mts file", () => {
    tester.run("digital-alchemy/no-service-module-scope-state", rule, {
      invalid: [
        {
          code: `var x = 1;`,
          errors: [{ messageId: "noModuleScopeState" }],
          filename: "x.service.mts",
        },
      ],
      valid: [],
    });
  });

  it("flags derived const (promisify call) at module scope in a .service.mts file", () => {
    tester.run("digital-alchemy/no-service-module-scope-state", rule, {
      invalid: [
        {
          code: `const execFileAsync = promisify(execFile);`,
          errors: [{ messageId: "noModuleScopeState" }],
          filename: "x.service.mts",
        },
      ],
      valid: [],
    });
  });

  it("flags dynamic Map (no seed args) at module scope in a .service.mts file", () => {
    tester.run("digital-alchemy/no-service-module-scope-state", rule, {
      invalid: [
        {
          code: `const cache = new Map();`,
          errors: [{ messageId: "noModuleScopeState" }],
          filename: "x.service.mts",
        },
      ],
      valid: [],
    });
  });

  it("flags derived const (makeClient call) at module scope in a .service.mts file", () => {
    tester.run("digital-alchemy/no-service-module-scope-state", rule, {
      invalid: [
        {
          code: `const client = makeClient();`,
          errors: [{ messageId: "noModuleScopeState" }],
          filename: "x.service.mts",
        },
      ],
      valid: [],
    });
  });

  it("flags exported dynamic Set at module scope in a .service.mts file", () => {
    tester.run("digital-alchemy/no-service-module-scope-state", rule, {
      invalid: [
        {
          code: `export const store = new Set();`,
          errors: [{ messageId: "noModuleScopeState" }],
          filename: "x.service.mts",
        },
      ],
      valid: [],
    });
  });

  it("allows imports and a service factory with closure-state only", () => {
    tester.run("digital-alchemy/no-service-module-scope-state", rule, {
      invalid: [],
      valid: [
        {
          code: `
import { something } from "./other.mts";
export function FooService({ logger }: TServiceParams) {
  const cache = new Map();
  return { get: () => cache };
}
          `.trim(),
          filename: "foo.service.mts",
        },
      ],
    });
  });

  it("does NOT flag const inside the service factory body", () => {
    tester.run("digital-alchemy/no-service-module-scope-state", rule, {
      invalid: [],
      valid: [
        {
          code: `
export function BarService({ logger }: TServiceParams) {
  const db = logger.child("db");
  const cache = new Map<string, string>();
  return { db, cache };
}
          `.trim(),
          filename: "bar.service.mts",
        },
      ],
    });
  });

  it("flags multiple non-static module-scope declarations in a .service.mts file, reports per-declarator", () => {
    tester.run("digital-alchemy/no-service-module-scope-state", rule, {
      invalid: [
        {
          code: `
const a = makeA();
const b = makeB();
export function BazService({ logger }: TServiceParams) {}
          `.trim(),
          errors: [{ messageId: "noModuleScopeState" }, { messageId: "noModuleScopeState" }],
          filename: "baz.service.mts",
        },
      ],
      valid: [],
    });
  });

  it("reports per-declarator for mixed static/derived in the same const statement", () => {
    tester.run("digital-alchemy/no-service-module-scope-state", rule, {
      invalid: [
        {
          // b is static (allowed), a is derived (flagged) -- only one error
          code: `const a = makeX(), b = "hello";`,

          errors: [{ messageId: "noModuleScopeState" }],
          filename: "x.service.mts",
        },
      ],
      valid: [],
    });
  });

  // Grounding example — the symmetric half of the FORMAT ping-pong test.
  it("allows hoistable CallExpression ([...].join(moduleScopeConst)) at module scope", () => {
    tester.run("digital-alchemy/no-service-module-scope-state", rule, {
      invalid: [],
      valid: [
        {
          code: `const FIELD_SEP = "x";\nconst FORMAT = ["#{a}", "#{b}"].join(FIELD_SEP);`,
          filename: "x.service.mts",
        },
      ],
    });
  });

  // Grounding example — a deeply-nested fully-static structure at module scope is hoistable.
  it("allows a deeply-nested fully-static structure at module scope", () => {
    tester.run("digital-alchemy/no-service-module-scope-state", rule, {
      invalid: [],
      valid: [
        {
          code: [
            "const LOCKS = [{",
            `  clearOn: { all: [{ agentType: "x", event: "SubagentStop" }], event: "All" },`,
            `  gates: { denyAll: false, denyMessage: "msg", tools: ["ExitPlanMode"] },`,
            `  name: "plan-it",`,
            `  setOn: { event: "UserPromptSubmit", promptMatches: /\\$plan-(it|review)\\b/ },`,
            "}];",
          ].join("\n"),
          filename: "x.service.mts",
        },
      ],
    });
  });

  // Impure / unresolvable calls must still be flagged even after adding hoistable-static support.
  it("still flags Date.now() at module scope as derived state", () => {
    tester.run("digital-alchemy/no-service-module-scope-state", rule, {
      invalid: [
        {
          code: `const now = Date.now();`,
          errors: [{ messageId: "noModuleScopeState" }],
          filename: "x.service.mts",
        },
      ],
      valid: [],
    });
  });

  // After unwrapping, `as const` / `satisfies` are transparent to hoistability.
  it("does NOT flag a module-scope `as const`-wrapped object in a .service.mts file", () => {
    tester.run("digital-alchemy/no-service-module-scope-state", rule, {
      invalid: [],
      valid: [
        {
          code: `const X = { a: 1 } as const;`,
          filename: "x.service.mts",
        },
        {
          code: `const Y = ["a", "b"] as const;`,
          filename: "x.service.mts",
        },
      ],
    });
  });

  // An empty object literal at module scope is a mutable accumulator, not a
  // static constant -- it must be flagged and moved into the factory closure.
  it("flags an empty object literal at module scope in a .service.mts file", () => {
    tester.run("digital-alchemy/no-service-module-scope-state", rule, {
      invalid: [
        {
          code: `const X = {};`,
          errors: [{ messageId: "noModuleScopeState" }],
          filename: "x.service.mts",
        },
      ],
      valid: [],
    });
  });
});

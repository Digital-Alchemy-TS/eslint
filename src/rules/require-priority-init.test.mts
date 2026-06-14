import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, afterEach, describe, it } from "vitest";

import { _resetModuleIndexForTests } from "../lib/module-index.mts";
import rule from "./require-priority-init.mts";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, "../../tests/fixtures/priority-init");

function fixture(name: string) {
  const filename = path.join(FIXTURE_DIR, name);
  return { code: fs.readFileSync(filename, "utf8"), filename };
}

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { project: "./tsconfig.json", tsconfigRootDir: FIXTURE_DIR },
  },
});

afterEach(() => {
  _resetModuleIndexForTests();
});

describe("require-priority-init", () => {
  it("flags a construction-read sibling missing from priorityInit", () => {
    tester.run("digital-alchemy/require-priority-init", rule, {
      invalid: [
        {
          ...fixture("missing.module.mts"),
          errors: [{ data: { module: "missing_app", service: "db_svc" }, messageId: "missing" }],
        },
      ],
      valid: [],
    });
  });

  it("flags a construction-read sibling even when it is declared before its consumer", () => {
    // Declaration order is NOT a valid second boot-order knob: db is read at
    // construction and must be in priorityInit even though it is declared first.
    tester.run("digital-alchemy/require-priority-init", rule, {
      invalid: [
        {
          ...fixture("decl-order.module.mts"),
          errors: [{ data: { module: "declorder_app", service: "db" }, messageId: "missing" }],
        },
      ],
      valid: [],
    });
  });

  it("accepts a listed sibling and callback-only reads", () => {
    tester.run("digital-alchemy/require-priority-init", rule, {
      invalid: [],
      valid: [fixture("good.module.mts"), fixture("callback.module.mts")],
    });
  });
});

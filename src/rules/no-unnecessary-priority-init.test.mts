import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import { afterEach, describe, it } from "vitest";

import { _resetModuleIndexForTests } from "../lib/module-index.mts";
import rule from "./no-unnecessary-priority-init.mts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, "../../tests/fixtures/priority-init");

function fixture(name: string) {
  const filename = path.join(FIXTURE_DIR, name);
  return { code: fs.readFileSync(filename, "utf8"), filename };
}

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: { project: "./tsconfig.json", tsconfigRootDir: FIXTURE_DIR },
  },
});

afterEach(() => {
  _resetModuleIndexForTests();
});

describe("no-unnecessary-priority-init", () => {
  it("flags a priorityInit entry no sibling construction-reads", () => {
    tester.run("digital-alchemy/no-unnecessary-priority-init", rule, {
      invalid: [
        {
          ...fixture("unused.module.mts"),
          errors: [{ data: { module: "unused_app", service: "lonely" }, messageId: "unused" }],
        },
      ],
      valid: [],
    });
  });

  it("accepts a priorityInit whose every entry is construction-read", () => {
    tester.run("digital-alchemy/no-unnecessary-priority-init", rule, {
      invalid: [],
      valid: [fixture("good.module.mts")],
    });
  });
});

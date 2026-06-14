import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, afterEach, describe, it } from "vitest";

import { _resetModuleIndexForTests } from "../lib/module-index.mts";
import rule from "./no-undeclared-module-dependency.mts";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, "../../tests/fixtures/no-undeclared-module-dependency");

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

describe("no-undeclared-module-dependency", () => {
  it("flags an undeclared module referenced via TServiceParams and via config", () => {
    tester.run("digital-alchemy/no-undeclared-module-dependency", rule, {
      invalid: [
        {
          ...fixture("api.service.mts"),
          errors: [
            { data: { dep: "bad_lib", owner: "my_app" }, messageId: "viaParam" },
            { data: { dep: "bad_lib", owner: "my_app" }, messageId: "viaConfig" },
          ],
        },
      ],
      valid: [],
    });
  });

  it("accepts a service referencing only declared deps and framework injects", () => {
    tester.run("digital-alchemy/no-undeclared-module-dependency", rule, {
      invalid: [],
      valid: [fixture("clean.service.mts")],
    });
  });
});

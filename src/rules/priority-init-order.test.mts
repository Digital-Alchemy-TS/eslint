import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, afterEach, describe, it } from "vitest";

import { _resetModuleIndexForTests } from "../lib/module-index.mts";
import rule from "./priority-init-order.mts";

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
    parserOptions: { projectService: true, tsconfigRootDir: FIXTURE_DIR },
  },
});

afterEach(() => {
  _resetModuleIndexForTests();
});

describe("priority-init-order", () => {
  describe("flags a producer that wires after a consumer that construction-reads it", () => {
    tester.run("priority-init-order", rule, {
      invalid: [
        {
          ...fixture("order.module.mts"),
          errors: [
            {
              data: { consumer: "consumer", module: "order_app", producer: "prod" },
              messageId: "order",
            },
          ],
        },
      ],
      valid: [],
    });
  });

  describe("accepts a producer that wires before its consumer", () => {
    tester.run("priority-init-order", rule, {
      invalid: [],
      valid: [fixture("good.module.mts")],
    });
  });
});

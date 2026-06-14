import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import { afterEach, describe, it } from "vitest";

import { _resetModuleIndexForTests } from "../lib/module-index.mts";
import rule from "./priority-init-order.mts";

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

describe("priority-init-order", () => {
  it("flags a producer that wires after a consumer that construction-reads it", () => {
    tester.run("digital-alchemy/priority-init-order", rule, {
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

  it("accepts a producer that wires before its consumer", () => {
    tester.run("digital-alchemy/priority-init-order", rule, {
      invalid: [],
      valid: [fixture("good.module.mts")],
    });
  });
});

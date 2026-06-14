import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "./no-service-class.mts";

const tester = new RuleTester({
  languageOptions: { parser: tsParser },
});

function serviceFile(code: string, extra = {}) {
  return { code, filename: "src/services/foo.service.mts", ...extra };
}

function testFile(code: string, extra = {}) {
  return { code, filename: "src/services/foo.service.test.mts", ...extra };
}

function plainMts(code: string, extra = {}) {
  return { code, filename: "src/helpers/bar.mts", ...extra };
}

describe("no-service-class", () => {
  it("flags a class declaration in a service file", () => {
    tester.run("digital-alchemy/no-service-class", rule, {
      invalid: [
        {
          ...serviceFile(`class Foo {}`),
          errors: [{ messageId: "noClass" }],
        },
      ],
      valid: [],
    });
  });

  it("flags a class expression in a service file", () => {
    tester.run("digital-alchemy/no-service-class", rule, {
      invalid: [
        {
          ...serviceFile(`const Foo = class {};`),
          errors: [{ messageId: "noClass" }],
        },
      ],
      valid: [],
    });
  });

  it("does not flag plain service functions", () => {
    tester.run("digital-alchemy/no-service-class", rule, {
      invalid: [],
      valid: [serviceFile(`function ServiceFoo() { return 1; }`)],
    });
  });

  it("does not apply in .test.mts files", () => {
    tester.run("digital-alchemy/no-service-class", rule, {
      invalid: [],
      valid: [testFile(`class Mock {}`)],
    });
  });

  it("does not apply in plain .mts files (not .service.mts)", () => {
    tester.run("digital-alchemy/no-service-class", rule, {
      invalid: [],
      valid: [plainMts(`class Helper {}`)],
    });
  });
});

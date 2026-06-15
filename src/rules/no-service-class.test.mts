import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";

import rule from "./no-service-class.mts";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester();

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
  describe("flags a class declaration in a service file", () => {
    tester.run("no-service-class", rule, {
      invalid: [
        {
          ...serviceFile(`class Foo {}`),
          errors: [{ messageId: "noClass" }],
        },
      ],
      valid: [],
    });
  });

  describe("flags a class expression in a service file", () => {
    tester.run("no-service-class", rule, {
      invalid: [
        {
          ...serviceFile(`const Foo = class {};`),
          errors: [{ messageId: "noClass" }],
        },
      ],
      valid: [],
    });
  });

  describe("does not flag plain service functions", () => {
    tester.run("no-service-class", rule, {
      invalid: [],
      valid: [serviceFile(`function ServiceFoo() { return 1; }`)],
    });
  });

  describe("does not apply in .test.mts files", () => {
    tester.run("no-service-class", rule, {
      invalid: [],
      valid: [testFile(`class Mock {}`)],
    });
  });

  describe("does not apply in plain .mts files (not .service.mts)", () => {
    tester.run("no-service-class", rule, {
      invalid: [],
      valid: [plainMts(`class Helper {}`)],
    });
  });
});

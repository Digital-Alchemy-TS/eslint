import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";

import rule from "./no-unused-service-params.mts";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester();

function serviceFile(code: string, extra = {}) {
  return { code, filename: "src/services/foo.service.mts", ...extra };
}

describe("no-unused-service-params", () => {
  describe("flags a destructured TServiceParams member that is never used", () => {
    tester.run("no-unused-service-params", rule, {
      invalid: [
        {
          ...serviceFile(
            `export function FooService({ logger, config }: TServiceParams) { logger.info("hi"); }`,
          ),
          errors: [{ data: { name: "config" }, messageId: "unusedParam" }],
          output: `export function FooService({ logger }: TServiceParams) { logger.info("hi"); }`,
        },
      ],
      valid: [],
    });
  });

  describe("does not flag when all members are used", () => {
    tester.run("no-unused-service-params", rule, {
      invalid: [],
      valid: [
        serviceFile(
          `export function FooService({ logger, config }: TServiceParams) { logger.info(config.x); }`,
        ),
      ],
    });
  });

  describe("handles renamed bindings", () => {
    tester.run("no-unused-service-params", rule, {
      invalid: [
        {
          ...serviceFile(
            `export function FooService({ config: cfg, logger }: TServiceParams) { logger.info("x"); }`,
          ),
          errors: [{ data: { name: "cfg" }, messageId: "unusedParam" }],
          output: `export function FooService({ logger }: TServiceParams) { logger.info("x"); }`,
        },
      ],
      valid: [],
    });
  });

  describe("reports but does NOT fix a lone member or a rest element", () => {
    tester.run("no-unused-service-params", rule, {
      invalid: [
        {
          // sole member — removing it would empty the pattern; report only
          ...serviceFile(`export function FooService({ config }: TServiceParams) {}`),
          errors: [{ data: { name: "config" }, messageId: "unusedParam" }],
        },
        {
          // rest element — not a plain member; report only
          ...serviceFile(
            `export function FooService({ logger, ...rest }: TServiceParams) { logger.info("x"); }`,
          ),
          errors: [{ data: { name: "rest" }, messageId: "unusedParam" }],
        },
      ],
      valid: [],
    });
  });

  describe("ignores functions whose param is not TServiceParams", () => {
    tester.run("no-unused-service-params", rule, {
      invalid: [],
      valid: [serviceFile(`function helper({ a, b }: SomeOther) { return a; }`)],
    });
  });
});

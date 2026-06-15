import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";

import rule from "./no-service-external-mutation.mts";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester();

describe("no-service-external-mutation", () => {
  describe("flags .push() on a module-scope binding inside a service factory", () => {
    tester.run("no-service-external-mutation", rule, {
      invalid: [
        {
          code: `
const EXTERNAL = ["x"];
export function S({ http }: TServiceParams) {
  EXTERNAL.push("a");
}
          `.trim(),
          errors: [{ data: { method: "push", name: "EXTERNAL" }, messageId: "noExternalMutation" }],
        },
      ],
      valid: [],
    });
  });

  describe("flags .splice() on a module-scope binding inside a service factory", () => {
    tester.run("no-service-external-mutation", rule, {
      invalid: [
        {
          code: `
const EXTERNAL = ["x", "y", "z"];
export function S({ http }: TServiceParams) {
  EXTERNAL.splice(0, 1);
}
          `.trim(),
          errors: [
            { data: { method: "splice", name: "EXTERNAL" }, messageId: "noExternalMutation" },
          ],
        },
      ],
      valid: [],
    });
  });

  describe("flags .sort() on a module-scope binding inside a service factory", () => {
    tester.run("no-service-external-mutation", rule, {
      invalid: [
        {
          code: `
const EXTERNAL = ["b", "a"];
export function S({ http }: TServiceParams) {
  EXTERNAL.sort();
}
          `.trim(),
          errors: [{ data: { method: "sort", name: "EXTERNAL" }, messageId: "noExternalMutation" }],
        },
      ],
      valid: [],
    });
  });

  describe("flags all other mutating methods on module-scope bindings", () => {
    tester.run("no-service-external-mutation", rule, {
      invalid: [
        {
          code: `
const ARR = [1, 2, 3];
export function S({ http }: TServiceParams) { ARR.pop(); }
          `.trim(),
          errors: [{ messageId: "noExternalMutation" }],
        },
        {
          code: `
const ARR = [1, 2, 3];
export function S({ http }: TServiceParams) { ARR.shift(); }
          `.trim(),
          errors: [{ messageId: "noExternalMutation" }],
        },
        {
          code: `
const ARR = [1, 2, 3];
export function S({ http }: TServiceParams) { ARR.unshift(0); }
          `.trim(),
          errors: [{ messageId: "noExternalMutation" }],
        },
        {
          code: `
const ARR = [1, 2, 3];
export function S({ http }: TServiceParams) { ARR.reverse(); }
          `.trim(),
          errors: [{ messageId: "noExternalMutation" }],
        },
        {
          code: `
const ARR = [1, 2, 3];
export function S({ http }: TServiceParams) { ARR.fill(0); }
          `.trim(),
          errors: [{ messageId: "noExternalMutation" }],
        },
        {
          code: `
const ARR = [1, 2, 3];
export function S({ http }: TServiceParams) { ARR.copyWithin(0, 1); }
          `.trim(),
          errors: [{ messageId: "noExternalMutation" }],
        },
      ],
      valid: [],
    });
  });

  describe("does NOT flag mutation of a service-local array", () => {
    tester.run("no-service-external-mutation", rule, {
      invalid: [],
      valid: [
        {
          // local is declared inside the factory — NOT external
          code: `
const EXTERNAL = ["x"];
export function S({ http }: TServiceParams) {
  const local = [...EXTERNAL];
  local.push("a");
}
          `.trim(),
        },
      ],
    });
  });

  describe("does NOT flag mutation OUTSIDE any service factory", () => {
    tester.run("no-service-external-mutation", rule, {
      invalid: [],
      valid: [
        {
          // top-level code — no service stack
          code: `
const EXTERNAL = ["x"];
EXTERNAL.push("a");
          `.trim(),
        },
        {
          // non-service function — param not typed TServiceParams
          code: `
const EXTERNAL = ["x"];
function helper() { EXTERNAL.push("a"); }
          `.trim(),
        },
      ],
    });
  });

  describe("does NOT flag non-mutating methods on module-scope bindings", () => {
    tester.run("no-service-external-mutation", rule, {
      invalid: [],
      valid: [
        {
          code: `
const EXTERNAL = ["x", "y"];
export function S({ http }: TServiceParams) {
  const mapped = EXTERNAL.map(x => x);
}
          `.trim(),
        },
        {
          code: `
const EXTERNAL = ["x", "y"];
export function S({ http }: TServiceParams) {
  const sliced = EXTERNAL.slice(0, 1);
}
          `.trim(),
        },
      ],
    });
  });
});

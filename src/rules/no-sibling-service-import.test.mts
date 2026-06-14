import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";

import rule from "./no-sibling-service-import.mts";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester();

describe("no-sibling-service-import", () => {
  describe("flags a regular import from a sibling service file", () => {
    tester.run("no-sibling-service-import", rule, {
      invalid: [
        {
          code: `import { x } from "./b.service.mts";`,
          errors: [{ messageId: "noSiblingServiceImport" }],
          filename: "src/foo/a.service.mts",
        },
      ],
      valid: [],
    });
  });

  describe("flags an import type from a sibling service file", () => {
    tester.run("no-sibling-service-import", rule, {
      invalid: [
        {
          code: `import type { T } from "./b.service.mts";`,
          errors: [{ messageId: "noSiblingServiceImport" }],
          filename: "src/foo/a.service.mts",
        },
      ],
      valid: [],
    });
  });

  describe("allows imports from contracts modules inside a service file", () => {
    tester.run("no-sibling-service-import", rule, {
      invalid: [],
      valid: [
        {
          code: `import { x } from "../contracts/index.mts";`,
          filename: "src/foo/a.service.mts",
        },
      ],
    });
  });

  describe("allows imports from non-service helpers inside a service file", () => {
    tester.run("no-sibling-service-import", rule, {
      invalid: [],
      valid: [
        {
          code: `import { x } from "./helper.mts";`,
          filename: "src/foo/a.service.mts",
        },
      ],
    });
  });

  describe("is inactive on non-service files", () => {
    tester.run("no-sibling-service-import", rule, {
      invalid: [],
      valid: [
        {
          code: `import { x } from "./b.service.mts";`,
          filename: "src/foo/a.controller.mts",
        },
      ],
    });
  });
});

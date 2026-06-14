import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "./no-sibling-service-import.mts";

const tester = new RuleTester({
  languageOptions: { parser: tsParser },
});

describe("no-sibling-service-import", () => {
  it("flags a regular import from a sibling service file", () => {
    tester.run("digital-alchemy/no-sibling-service-import", rule, {
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

  it("flags an import type from a sibling service file", () => {
    tester.run("digital-alchemy/no-sibling-service-import", rule, {
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

  it("allows imports from contracts modules inside a service file", () => {
    tester.run("digital-alchemy/no-sibling-service-import", rule, {
      invalid: [],
      valid: [
        {
          code: `import { x } from "../contracts/index.mts";`,
          filename: "src/foo/a.service.mts",
        },
      ],
    });
  });

  it("allows imports from non-service helpers inside a service file", () => {
    tester.run("digital-alchemy/no-sibling-service-import", rule, {
      invalid: [],
      valid: [
        {
          code: `import { x } from "./helper.mts";`,
          filename: "src/foo/a.service.mts",
        },
      ],
    });
  });

  it("is inactive on non-service files", () => {
    tester.run("digital-alchemy/no-sibling-service-import", rule, {
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

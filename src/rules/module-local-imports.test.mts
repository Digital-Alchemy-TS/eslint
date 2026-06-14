import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "./module-local-imports.mts";

const tester = new RuleTester({
  languageOptions: { parser: tsParser },
});

describe("module-local-imports", () => {
  it("allows library imports from parent directories", () => {
    tester.run("digital-alchemy/module-local-imports", rule, {
      invalid: [],
      valid: [
        {
          code: [
            `import { LIB_DB } from "../db/index.mts";`,
            `export const APP = CreateApplication({ libraries: [LIB_DB], name: "app", services: {} });`,
          ].join("\n"),
          filename: "src/app.module.mts",
        },
      ],
    });
  });

  it("allows services from local subfolders", () => {
    tester.run("digital-alchemy/module-local-imports", rule, {
      invalid: [],
      valid: [
        {
          code: [
            `import { CliService } from "./services/index.mts";`,
            `export const APP = CreateApplication({ name: "app", services: { cli: CliService } });`,
          ].join("\n"),
          filename: "src/app.module.mts",
        },
      ],
    });
  });

  it("allows services from packages", () => {
    tester.run("digital-alchemy/module-local-imports", rule, {
      invalid: [],
      valid: [
        {
          code: [
            `import { ExternalService } from "@org/shared";`,
            `export const APP = CreateApplication({ name: "app", services: { ext: ExternalService } });`,
          ].join("\n"),
          filename: "src/app.module.mts",
        },
      ],
    });
  });

  it("ignores non-module files", () => {
    tester.run("digital-alchemy/module-local-imports", rule, {
      invalid: [],
      valid: [
        {
          code: [
            `import { CliService } from "../services/index.mts";`,
            `export const APP = CreateApplication({ name: "app", services: { cli: CliService } });`,
          ].join("\n"),
          filename: "src/app.service.mts",
        },
      ],
    });
  });

  it("flags services imported from parent directories", () => {
    tester.run("digital-alchemy/module-local-imports", rule, {
      invalid: [
        {
          code: [
            `import { CliService } from "../services/index.mts";`,
            `export const APP = CreateApplication({ name: "app", services: { cli: CliService } });`,
          ].join("\n"),
          errors: [{ messageId: "noParentService" }],
          filename: "src/app-cli/app-cli.module.mts",
        },
        {
          code: [
            `import { FooService } from "../../services/foo.mts";`,
            `import { LIB_DB } from "../db/index.mts";`,
            `export const APP = CreateApplication({`,
            `  libraries: [LIB_DB], name: "app", services: { foo: FooService } });`,
          ].join("\n"),
          errors: [{ messageId: "noParentService" }],
          filename: "src/my-app/my-app.module.mts",
        },
      ],
      valid: [],
    });
  });
});

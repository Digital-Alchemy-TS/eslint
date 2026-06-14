import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";

import rule from "./module-declaration-merge.mts";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester();

describe("module-declaration-merge", () => {
  it("allows correct pattern with declaration merge after definition", () => {
    tester.run("digital-alchemy/module-declaration-merge", rule, {
      invalid: [],
      valid: [
        {
          code: [
            `import { CreateApplication } from "@digital-alchemy/core";`,
            `export const APP = CreateApplication({ name: "app", services: {} });`,
            `declare module "@digital-alchemy/core" {`,
            `  export interface LoadedModules { app: typeof APP }`,
            `}`,
          ].join("\n"),
        },
        {
          code: [
            `import { CreateLibrary } from "@digital-alchemy/core";`,
            `export const LIB = CreateLibrary({ name: "lib", services: {} });`,
            `declare module "@digital-alchemy/core" {`,
            `  export interface LoadedModules { lib: typeof LIB }`,
            `}`,
          ].join("\n"),
        },
      ],
    });
  });

  it("allows correct pattern with a different import source", () => {
    tester.run("digital-alchemy/module-declaration-merge", rule, {
      invalid: [],
      valid: [
        {
          code: [
            `import { CreateLibrary } from "@my-org/framework";`,
            `export const LIB = CreateLibrary({ name: "lib", services: {} });`,
            `declare module "@my-org/framework" {`,
            `  export interface LoadedModules { lib: typeof LIB }`,
            `}`,
          ].join("\n"),
        },
      ],
    });
  });

  it("ignores files without CreateApplication or CreateLibrary", () => {
    tester.run("digital-alchemy/module-declaration-merge", rule, {
      invalid: [],
      valid: [
        { code: `export function foo() {}` },
        { code: `import { something } from "@digital-alchemy/core";` },
      ],
    });
  });

  it("flags missing declare module block", () => {
    tester.run("digital-alchemy/module-declaration-merge", rule, {
      invalid: [
        {
          code: [
            `import { CreateApplication } from "@digital-alchemy/core";`,
            `export const APP = CreateApplication({ name: "app", services: {} });`,
          ].join("\n"),
          errors: [{ messageId: "missingDeclare" }],
        },
      ],
      valid: [],
    });
  });

  it("flags declare module without LoadedModules interface", () => {
    tester.run("digital-alchemy/module-declaration-merge", rule, {
      invalid: [
        {
          code: [
            `import { CreateApplication } from "@digital-alchemy/core";`,
            `export const APP = CreateApplication({ name: "app", services: {} });`,
            `declare module "@digital-alchemy/core" {`,
            `  export interface SomethingElse { app: typeof APP }`,
            `}`,
          ].join("\n"),
          errors: [{ messageId: "missingLoadedModules" }],
        },
      ],
      valid: [],
    });
  });

  it("flags LoadedModules key that doesn't match the name property", () => {
    tester.run("digital-alchemy/module-declaration-merge", rule, {
      invalid: [
        {
          code: [
            `import { CreateApplication } from "@digital-alchemy/core";`,
            `export const APP = CreateApplication({ name: "my_app", services: {} });`,
            `declare module "@digital-alchemy/core" {`,
            `  export interface LoadedModules { wrong_name: typeof APP }`,
            `}`,
          ].join("\n"),
          errors: [
            { data: { actual: "wrong_name", expected: "my_app" }, messageId: "nameMismatch" },
          ],
        },
      ],
      valid: [],
    });
  });

  it("flags declare module that appears before the definition", () => {
    tester.run("digital-alchemy/module-declaration-merge", rule, {
      invalid: [
        {
          code: [
            `import { CreateApplication } from "@digital-alchemy/core";`,
            `declare module "@digital-alchemy/core" {`,
            `  export interface LoadedModules { app: typeof APP }`,
            `}`,
            `export const APP = CreateApplication({ name: "app", services: {} });`,
          ].join("\n"),
          errors: [{ messageId: "declareBefore" }],
        },
      ],
      valid: [],
    });
  });
});

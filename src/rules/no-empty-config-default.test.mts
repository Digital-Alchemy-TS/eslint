import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";

import rule from "./no-empty-config-default.mts";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester();

describe("no-empty-config-default", () => {
  it("allows configuration entries with required: true", () => {
    tester.run("digital-alchemy/no-empty-config-default", rule, {
      invalid: [],
      valid: [
        {
          code: `CreateLibrary({
            configuration: {
              TMUX_SOCKET_DIR: { type: "string", required: true },
            },
          });`,
        },
      ],
    });
  });

  it("allows configuration entries with a meaningful default", () => {
    tester.run("digital-alchemy/no-empty-config-default", rule, {
      invalid: [],
      valid: [
        {
          code: `CreateLibrary({
            configuration: {
              NAME: { type: "string", default: "coordinator" },
            },
          });`,
        },
        {
          code: `CreateApplication({
            configuration: {
              PORT: { type: "number", default: 3000 },
            },
          });`,
        },
      ],
    });
  });

  it("does not flag a switch default: statement", () => {
    tester.run("digital-alchemy/no-empty-config-default", rule, {
      invalid: [],
      valid: [
        {
          code: `switch (x) { default: break; }`,
        },
      ],
    });
  });

  it("does not flag an unrelated object with default: ''", () => {
    tester.run("digital-alchemy/no-empty-config-default", rule, {
      invalid: [],
      valid: [
        {
          // Not under a `configuration` key — must not be reported
          code: `const opts = { fallback: { default: "" } };`,
        },
        {
          // Top-level object with default: "" but not nested under configuration
          code: `const x = { default: "" };`,
        },
      ],
    });
  });

  it("flags configuration entries with default: ''", () => {
    tester.run("digital-alchemy/no-empty-config-default", rule, {
      invalid: [
        {
          code: `CreateLibrary({
            configuration: {
              TMUX_SOCKET_DIR: { type: "string", default: "" },
            },
          });`,
          errors: [{ messageId: "noEmptyDefault" }],
        },
      ],
      valid: [],
    });
  });

  it("flags multiple empty-string defaults in one configuration block", () => {
    tester.run("digital-alchemy/no-empty-config-default", rule, {
      invalid: [
        {
          code: `CreateLibrary({
            configuration: {
              HOST: { type: "string", default: "" },
              PATH: { type: "string", default: "" },
            },
          });`,
          errors: [{ messageId: "noEmptyDefault" }, { messageId: "noEmptyDefault" }],
        },
      ],
      valid: [],
    });
  });

  it("flags empty-string default even when other properties are fine", () => {
    tester.run("digital-alchemy/no-empty-config-default", rule, {
      invalid: [
        {
          code: `CreateLibrary({
            configuration: {
              GOOD: { type: "string", required: true },
              BAD: { type: "string", default: "" },
            },
          });`,
          errors: [{ messageId: "noEmptyDefault" }],
        },
      ],
      valid: [],
    });
  });

  it("does not crash or report for boolean-typed config entry (PR_HISTORY_ENABLED pattern)", () => {
    // Regression: is.empty(true) throws "Unsupported type boolean" from
    // @digital-alchemy/core — the guard must skip non-string literal defaults.
    tester.run("digital-alchemy/no-empty-config-default", rule, {
      invalid: [],
      valid: [
        {
          code: `CreateLibrary({
            configuration: {
              PR_HISTORY_ENABLED: { type: "boolean", default: true },
            },
          });`,
        },
        {
          code: `CreateLibrary({
            configuration: {
              PORT: { type: "number", default: 8080 },
            },
          });`,
        },
        {
          code: `CreateApplication({
            configuration: {
              ENABLED: { type: "boolean", default: false },
              RETRIES: { type: "number", default: 3 },
              HOST: { type: "string", default: "localhost" },
            },
          });`,
        },
      ],
    });
  });
});

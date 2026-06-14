import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";

import rule from "./no-toplevel-config.mts";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester();

describe("no-toplevel-config", () => {
  describe("allows config inside nested functions", () => {
    tester.run("no-toplevel-config", rule, {
      invalid: [],
      valid: [
        {
          code: `
            function MyService({ config }) {
              function doWork() {
                return config.my_lib.KEY;
              }
            }
          `,
        },
        {
          code: `
            function MyService({ config }) {
              const doWork = () => config.my_lib.KEY;
            }
          `,
        },
        {
          code: `
            function MyService({ config, lifecycle }) {
              lifecycle.onReady(() => {
                if (config.my_lib.ENABLED) { doStuff(); }
              });
            }
          `,
        },
      ],
    });
  });

  describe("catches config access at top level", () => {
    tester.run("no-toplevel-config", rule, {
      invalid: [
        {
          code: `
            function MyService({ config }) {
              const x = config.my_lib.KEY;
            }
          `,
          errors: [{ messageId: "toplevelConfig" }],
        },
        {
          code: `
            function MyService({ config }) {
              if (config.my_lib.ENABLED) { return; }
            }
          `,
          errors: [{ messageId: "toplevelConfig" }],
        },
        {
          code: `
            function MyService({ config, logger }) {
              logger.info(config.my_lib.NAME);
            }
          `,
          errors: [{ messageId: "toplevelConfig" }],
        },
      ],
      valid: [],
    });
  });

  describe("allows concise-body arrow config accessors", () => {
    tester.run("no-toplevel-config", rule, {
      invalid: [],
      valid: [
        {
          code: `
            const Pricing = createPricing(
              ({ config }) => ({
                PBM_ID: config.my_lib.PBM_ID,
                PBM_NAME: config.my_lib.PBM_NAME,
              }),
            );
          `,
        },
        {
          code: `
            const Tokens = createTokens(({ config }) => ({
              CLIENT_ID: config.my_lib.CLIENT_ID,
              CLIENT_SECRET: config.my_lib.CLIENT_SECRET,
            }));
          `,
        },
        {
          code: `
            const getter = ({ config }) => config.my_lib.KEY;
          `,
        },
      ],
    });
  });

  describe("ignores functions without config param", () => {
    tester.run("no-toplevel-config", rule, {
      invalid: [],
      valid: [
        {
          code: `
            function helper({ logger }) {
              return logger.info("no config here");
            }
          `,
        },
        {
          code: `
            function util(config) {
              return config.something;
            }
          `,
        },
      ],
    });
  });

  describe("handles arrow function services", () => {
    tester.run("no-toplevel-config", rule, {
      invalid: [
        {
          code: `
            const MyService = ({ config }) => {
              config.my_lib.KEY;
            };
          `,
          errors: [{ messageId: "toplevelConfig" }],
        },
      ],
      valid: [],
    });
  });
});

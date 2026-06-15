import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";

import rule from "./no-construction-side-effects.mts";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

// The rule is filename-gated: only active in *.service.mts files.
const SERVICE_FILE = "src/example.service.mts";

const SIDE_EFFECT_MSG_ID = "noConstructionSideEffects";

const tester = new RuleTester();

describe("no-construction-side-effects", () => {
  describe("valid: service with only variable declarations and return", () => {
    tester.run("no-construction-side-effects", rule, {
      invalid: [],
      valid: [
        {
          code: `
export function MyService({ lifecycle }: TServiceParams) {
  const foo = "bar";
  const doThing = () => {};
  return { doThing };
}
          `.trim(),
          filename: SERVICE_FILE,
        },
      ],
    });
  });

  describe("valid: lifecycle.onPreInit call at root is allowed", () => {
    tester.run("no-construction-side-effects", rule, {
      invalid: [],
      valid: [
        {
          code: `
export function MyService({ lifecycle }: TServiceParams) {
  lifecycle.onPreInit(() => {
    registry.register("thing");
  });
  return {};
}
          `.trim(),
          filename: SERVICE_FILE,
        },
      ],
    });
  });

  describe("valid: all lifecycle hooks are allowed at root", () => {
    tester.run("no-construction-side-effects", rule, {
      invalid: [],
      valid: [
        {
          code: `
export function MyService({ lifecycle }: TServiceParams) {
  lifecycle.onBootstrap(() => {});
  lifecycle.onReady(() => {});
  lifecycle.onPreShutdown(() => {});
  return {};
}
          `.trim(),
          filename: SERVICE_FILE,
        },
      ],
    });
  });

  describe("valid: function declaration inside service is allowed", () => {
    tester.run("no-construction-side-effects", rule, {
      invalid: [],
      valid: [
        {
          code: `
export function MyService({ lifecycle }: TServiceParams) {
  function helper() { return 1; }
  return { helper };
}
          `.trim(),
          filename: SERVICE_FILE,
        },
      ],
    });
  });

  describe("valid: non-service file is ignored entirely", () => {
    tester.run("no-construction-side-effects", rule, {
      invalid: [],
      valid: [
        {
          code: `registry.register("thing");`,
          filename: "src/example.module.mts",
        },
        {
          code: `logger.debug("init");`,
          filename: "src/example.ts",
        },
      ],
    });
  });

  describe("invalid: registry.register(...) at root -- motivating instance", () => {
    tester.run("no-construction-side-effects", rule, {
      invalid: [
        {
          code: `
export function WorkflowSecretsSourceKind({ registry, logger }: TServiceParams) {
  if (registry.isReady()) {
    logger.debug("ready");
  }
  registry.register("KIND");
  logger.debug("registered");
  return {};
}
          `.trim(),
          errors: [
            {
              messageId: SIDE_EFFECT_MSG_ID,
            },
            {
              messageId: SIDE_EFFECT_MSG_ID,
            },
            {
              messageId: SIDE_EFFECT_MSG_ID,
            },
          ],
          filename: SERVICE_FILE,
        },
      ],
      valid: [],
    });
  });

  describe("invalid: bare call expression at root (logger.debug)", () => {
    tester.run("no-construction-side-effects", rule, {
      invalid: [
        {
          code: `
export function VocabSlotRegistration({ logger, framework_search }: TServiceParams) {
  framework_search.singular_slot_registry.registerVocab(VOCAB);
  logger.debug("registered vocab");
  return {};
}
          `.trim(),
          errors: [
            {
              messageId: SIDE_EFFECT_MSG_ID,
            },
            {
              messageId: SIDE_EFFECT_MSG_ID,
            },
          ],
          filename: SERVICE_FILE,
        },
      ],
      valid: [],
    });
  });

  describe("invalid: if statement at root", () => {
    tester.run("no-construction-side-effects", rule, {
      invalid: [
        {
          code: `
export function MyService({ config }: TServiceParams) {
  if (config.enabled) {
    doSetup();
  }
  return {};
}
          `.trim(),
          errors: [
            {
              messageId: SIDE_EFFECT_MSG_ID,
            },
          ],
          filename: SERVICE_FILE,
        },
      ],
      valid: [],
    });
  });

  describe("invalid: try/catch at root", () => {
    tester.run("no-construction-side-effects", rule, {
      invalid: [
        {
          code: `
export function MyService({}: TServiceParams) {
  try {
    doSomething();
  } catch (e) {
    handleError(e);
  }
  return {};
}
          `.trim(),
          errors: [
            {
              messageId: SIDE_EFFECT_MSG_ID,
            },
          ],
          filename: SERVICE_FILE,
        },
      ],
      valid: [],
    });
  });

  describe("invalid: other.method() call is not lifecycle and is flagged", () => {
    tester.run("no-construction-side-effects", rule, {
      invalid: [
        {
          code: `
export function MyService({ other }: TServiceParams) {
  other.setup();
  return {};
}
          `.trim(),
          errors: [
            {
              messageId: SIDE_EFFECT_MSG_ID,
            },
          ],
          filename: SERVICE_FILE,
        },
      ],
      valid: [],
    });
  });

  // ─── Framework-wiring allowlist ───────────────────────────────────────────

  describe("valid: http.controller() at factory root is allowlisted", () => {
    tester.run("no-construction-side-effects", rule, {
      invalid: [],
      valid: [
        {
          // http.controller defers mounting to onBootstrap internally.
          code: `
export function McpController({ http, kg_mcp }: TServiceParams) {
  http.controller("/mcp", (fastify) => {
    fastify.post("/", ({ body }, reply) => kg_mcp.mcp.handlePost(body, reply));
  });
}
          `.trim(),
          filename: SERVICE_FILE,
        },
        {
          code: `
export function ProfileController({ http, matrix }: TServiceParams) {
  http.controller("/profile", (fastify) => {
    fastify.post("/display-name", {}, async ({ body }) => matrix.setName(body.name));
  });
}
          `.trim(),
          filename: SERVICE_FILE,
        },
      ],
    });
  });

  describe("valid: scheduler.cron() at factory root is allowlisted", () => {
    tester.run("no-construction-side-effects", rule, {
      invalid: [],
      valid: [
        {
          // scheduler.cron registers a cron job with the DA scheduler.
          code: `
export function PlayerService({ scheduler }: TServiceParams) {
  scheduler.cron({
    exec() { doWork(); },
    schedule: "* * * * *",
  });
  return {};
}
          `.trim(),
          filename: SERVICE_FILE,
        },
        {
          code: `
export function NothingPhoneService({ scheduler, lifecycle }: TServiceParams) {
  scheduler.cron({
    exec: async () => await updateState(),
    schedule: "*/5 * * * *",
  });
  lifecycle.onReady(async () => await updateState());
}
          `.trim(),
          filename: SERVICE_FILE,
        },
      ],
    });
  });

  describe("invalid: http.otherMethod() is NOT in the allowlist and is flagged", () => {
    tester.run("no-construction-side-effects", rule, {
      invalid: [
        {
          code: `
export function MyService({ http }: TServiceParams) {
  http.listen(3000);
  return {};
}
          `.trim(),
          errors: [{ messageId: SIDE_EFFECT_MSG_ID }],
          filename: SERVICE_FILE,
        },
      ],
      valid: [],
    });
  });

  describe("invalid: scheduler.otherMethod() is NOT in the allowlist and is flagged", () => {
    tester.run("no-construction-side-effects", rule, {
      invalid: [
        {
          code: `
export function MyService({ scheduler }: TServiceParams) {
  scheduler.setInterval(async () => work(), 5000);
  return {};
}
          `.trim(),
          errors: [{ messageId: SIDE_EFFECT_MSG_ID }],
          filename: SERVICE_FILE,
        },
      ],
      valid: [],
    });
  });

  describe("invalid: other.controller() is not http.controller and is flagged", () => {
    tester.run("no-construction-side-effects", rule, {
      invalid: [
        {
          code: `
export function MyService({ router }: TServiceParams) {
  router.controller("/foo", () => {});
  return {};
}
          `.trim(),
          errors: [{ messageId: SIDE_EFFECT_MSG_ID }],
          filename: SERVICE_FILE,
        },
      ],
      valid: [],
    });
  });
});

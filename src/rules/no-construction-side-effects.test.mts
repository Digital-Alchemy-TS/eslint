import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "./no-construction-side-effects.mts";

// The rule is filename-gated: only active in *.service.mts files.
const SERVICE_FILE = "src/example.service.mts";

const SIDE_EFFECT_MSG = [
  "Construction is for wiring definitions; side effects belong in lifecycle hooks",
  "-- `lifecycle.onPreInit` is early enough.",
].join(" ");

const tester = new RuleTester({
  languageOptions: { parser: tsParser },
});

describe("no-construction-side-effects", () => {
  it("valid: service with only variable declarations and return", () => {
    tester.run("digital-alchemy/no-construction-side-effects", rule, {
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

  it("valid: lifecycle.onPreInit call at root is allowed", () => {
    tester.run("digital-alchemy/no-construction-side-effects", rule, {
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

  it("valid: all lifecycle hooks are allowed at root", () => {
    tester.run("digital-alchemy/no-construction-side-effects", rule, {
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

  it("valid: function declaration inside service is allowed", () => {
    tester.run("digital-alchemy/no-construction-side-effects", rule, {
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

  it("valid: non-service file is ignored entirely", () => {
    tester.run("digital-alchemy/no-construction-side-effects", rule, {
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

  it("invalid: registry.register(...) at root -- motivating instance", () => {
    tester.run("digital-alchemy/no-construction-side-effects", rule, {
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
              message: SIDE_EFFECT_MSG,
            },
            {
              message: SIDE_EFFECT_MSG,
            },
            {
              message: SIDE_EFFECT_MSG,
            },
          ],
          filename: SERVICE_FILE,
        },
      ],
      valid: [],
    });
  });

  it("invalid: bare call expression at root (logger.debug)", () => {
    tester.run("digital-alchemy/no-construction-side-effects", rule, {
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
              message: SIDE_EFFECT_MSG,
            },
            {
              message: SIDE_EFFECT_MSG,
            },
          ],
          filename: SERVICE_FILE,
        },
      ],
      valid: [],
    });
  });

  it("invalid: if statement at root", () => {
    tester.run("digital-alchemy/no-construction-side-effects", rule, {
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
              message: SIDE_EFFECT_MSG,
            },
          ],
          filename: SERVICE_FILE,
        },
      ],
      valid: [],
    });
  });

  it("invalid: try/catch at root", () => {
    tester.run("digital-alchemy/no-construction-side-effects", rule, {
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
              message: SIDE_EFFECT_MSG,
            },
          ],
          filename: SERVICE_FILE,
        },
      ],
      valid: [],
    });
  });

  it("invalid: other.method() call is not lifecycle and is flagged", () => {
    tester.run("digital-alchemy/no-construction-side-effects", rule, {
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
              message: SIDE_EFFECT_MSG,
            },
          ],
          filename: SERVICE_FILE,
        },
      ],
      valid: [],
    });
  });

  // ─── Framework-wiring allowlist ───────────────────────────────────────────

  it("valid: http.controller() at factory root is allowlisted", () => {
    tester.run("digital-alchemy/no-construction-side-effects", rule, {
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

  it("valid: scheduler.cron() at factory root is allowlisted", () => {
    tester.run("digital-alchemy/no-construction-side-effects", rule, {
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

  it("invalid: http.otherMethod() is NOT in the allowlist and is flagged", () => {
    tester.run("digital-alchemy/no-construction-side-effects", rule, {
      invalid: [
        {
          code: `
export function MyService({ http }: TServiceParams) {
  http.listen(3000);
  return {};
}
          `.trim(),
          errors: [{ message: SIDE_EFFECT_MSG }],
          filename: SERVICE_FILE,
        },
      ],
      valid: [],
    });
  });

  it("invalid: scheduler.otherMethod() is NOT in the allowlist and is flagged", () => {
    tester.run("digital-alchemy/no-construction-side-effects", rule, {
      invalid: [
        {
          code: `
export function MyService({ scheduler }: TServiceParams) {
  scheduler.setInterval(async () => work(), 5000);
  return {};
}
          `.trim(),
          errors: [{ message: SIDE_EFFECT_MSG }],
          filename: SERVICE_FILE,
        },
      ],
      valid: [],
    });
  });

  it("invalid: other.controller() is not http.controller and is flagged", () => {
    tester.run("digital-alchemy/no-construction-side-effects", rule, {
      invalid: [
        {
          code: `
export function MyService({ router }: TServiceParams) {
  router.controller("/foo", () => {});
  return {};
}
          `.trim(),
          errors: [{ message: SIDE_EFFECT_MSG }],
          filename: SERVICE_FILE,
        },
      ],
      valid: [],
    });
  });
});

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it, expect } from "vitest";

import type { TSESLint } from "@typescript-eslint/utils";
import plugin from "./index.mts";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");

const TYPE_AWARE_RULES = new Set([
  "require-priority-init",
  "priority-init-order",
  "no-unnecessary-priority-init",
  "no-undeclared-module-dependency",
]);

describe("plugin completeness", () => {
  it("exports exactly 14 rules", () => {
    expect(Object.keys(plugin.rules ?? {})).toHaveLength(14);
  });

  it("configs.recommended has exactly one entry per rule, matching 1:1", () => {
    const ruleNames = Object.keys(plugin.rules ?? {});
    const recommended = plugin.configs?.["recommended"] as TSESLint.FlatConfig.Config;
    const recommendedEntries = Object.keys(recommended?.rules ?? {});

    // Exactly one recommended entry per rule
    expect(recommendedEntries).toHaveLength(ruleNames.length);

    // Every rule has a recommended entry
    for (const name of ruleNames) {
      expect(
        recommended?.rules,
        `expected recommended config to have digital-alchemy/${name}`,
      ).toHaveProperty(`digital-alchemy/${name}`, "error");
    }

    // Every recommended entry corresponds to a real rule (no orphans)
    for (const key of recommendedEntries) {
      const stripped = key.replace(/^digital-alchemy\//, "");
      expect(
        plugin.rules,
        `recommended entry "${key}" has no corresponding rule`,
      ).toHaveProperty(stripped);
    }
  });

  it("every rule has meta.type, non-empty meta.messages, and a correct meta.docs.url", () => {
    for (const [name, rawRule] of Object.entries(plugin.rules ?? {})) {
      const rule = rawRule as TSESLint.AnyRuleModule;
      expect(rule.meta?.type, `${name}: missing meta.type`).toBeTruthy();
      expect(
        Object.keys(rule.meta?.messages ?? {}),
        `${name}: meta.messages must be non-empty`,
      ).not.toHaveLength(0);
      expect(
        rule.meta?.docs?.url,
        `${name}: meta.docs.url must end in /docs/rules/${name}.md`,
      ).toMatch(`/docs/rules/${name}.md`);
    }
  });

  it("every rule has meta.docs.recommended === true", () => {
    for (const [name, rawRule] of Object.entries(plugin.rules ?? {})) {
      const rule = rawRule as TSESLint.AnyRuleModuleWithMetaDocs;
      // docs is typed as PluginDocs & RuleMetaDataDocs; access via index for custom fields
      const docs = rule.meta.docs as { recommended?: unknown; requiresTypeChecking?: unknown };
      expect(
        docs?.recommended,
        `${name}: meta.docs.recommended must be true`,
      ).toBe(true);
    }
  });

  it("type-aware rules have requiresTypeChecking === true; others do not", () => {
    for (const [name, rawRule] of Object.entries(plugin.rules ?? {})) {
      const rule = rawRule as TSESLint.AnyRuleModuleWithMetaDocs;
      const docs = rule.meta.docs as { recommended?: unknown; requiresTypeChecking?: unknown };
      const flag = docs?.requiresTypeChecking;
      if (TYPE_AWARE_RULES.has(name)) {
        expect(flag, `${name}: expected requiresTypeChecking === true`).toBe(true);
      } else {
        expect(flag, `${name}: expected requiresTypeChecking to be absent/false`).toBeFalsy();
      }
    }
  });

  it("a docs/rules/<name>.md file exists on disk for every rule", () => {
    for (const name of Object.keys(plugin.rules ?? {})) {
      const docPath = path.join(REPO_ROOT, "docs", "rules", `${name}.md`);
      expect(
        existsSync(docPath),
        `docs/rules/${name}.md not found at ${docPath}`,
      ).toBe(true);
    }
  });
});

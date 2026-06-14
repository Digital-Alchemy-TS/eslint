import type { ESLint, Linter } from "eslint";

type PluginConfig = Linter.Config & { name: string };

type EslintPlugin = {
  meta: { name: string; version: string };
  rules: Record<string, never>;
  configs: Record<string, PluginConfig>;
};

const plugin: EslintPlugin = {
  meta: { name: "@digital-alchemy/eslint", version: "0.0.1" },
  rules: {},
  configs: {},
};

plugin.configs["recommended"] = {
  name: "digital-alchemy/recommended",
  plugins: { "digital-alchemy": plugin as unknown as ESLint.Plugin },
  rules: {},
};

export default plugin;

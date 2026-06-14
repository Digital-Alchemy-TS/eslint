import type { Rule } from "eslint";

/** Resolve a descriptor property's key name, or undefined for computed keys. */
function descriptorKeyName(descProp: { key: { type: string; name?: string; value?: unknown } }): string {
  if (descProp.key.type === "Identifier") {
    return descProp.key.name;
  }
  if (descProp.key.type === "Literal") {
    return String(descProp.key.value);
  }
  return undefined;
}

/** Whether a descriptor property is `default: ""`. */
function isEmptyDefault(descProp: { type: string; key: { type: string; name?: string; value?: unknown }; value: { type: string; value?: unknown } }): boolean {
  if (descProp.type !== "Property") {
    return false;
  }
  if (descriptorKeyName(descProp) !== "default") {
    return false;
  }
  if (descProp.value.type !== "Literal") {
    return false;
  }
  // Guard: only string literals can be empty-string defaults.
  // Unsupported literal types (boolean, number, …) are silently skipped —
  // the rule only checks for the `default: ""` string-empty pattern and has
  // no semantics for other literal kinds.
  if (typeof descProp.value.value !== "string") {
    return false;
  }
  return !descProp.value.value?.length;
}

const rule: Rule.RuleModule = {
  create(context) {
    // Report any `default: ""` descriptor inside a single config-key block.
    function checkConfigKey(configProp: { type: string; value: { type: string; properties: unknown[] } }) {
      if (configProp.type !== "Property" || configProp.value.type !== "ObjectExpression") {
        return;
      }
      for (const descProp of configProp.value.properties) {
        if (isEmptyDefault(descProp as Parameters<typeof isEmptyDefault>[0])) {
          context.report({ messageId: "noEmptyDefault", node: descProp as unknown as Rule.Node });
        }
      }
    }

    return {
      Property(node) {
        // We are looking for a Property whose key is `configuration` and whose
        // value is an ObjectExpression — the configuration block inside
        // CreateLibrary / CreateApplication args.
        if (node.key.type !== "Identifier" || (node.key as { name?: string }).name !== "configuration") {
          return;
        }
        if (node.value.type !== "ObjectExpression") {
          return;
        }

        // Each child property is a config key (e.g. TMUX_SOCKET_DIR: { ... }).
        for (const configProp of (node.value as { properties: unknown[] }).properties) {
          checkConfigKey(configProp as Parameters<typeof checkConfigKey>[0]);
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow empty-string defaults in Digital Alchemy `configuration` entries",
      recommended: true,
      url: "https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/no-empty-config-default.md",
    },
    messages: {
      noEmptyDefault:
        "Config keys must not default to an empty string; use `required: true` or a meaningful default.",
    },
    schema: [],
    type: "problem",
  },
};

export default rule;

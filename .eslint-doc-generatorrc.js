/** @type {import('eslint-doc-generator').GenerateOptions} */
const config = {
  // Map the recommended config to a checkmark emoji
  configEmoji: [["recommended", "✅"]],

  // Rule doc path (default matches, stated explicitly for clarity)
  pathRuleDoc: "docs/rules/{name}.md",

  // Ensure the url in meta.docs matches what the generator expects so --check doesn't diff
  urlRuleDoc: (name) =>
    `https://github.com/Digital-Alchemy-TS/eslint/blob/main/docs/rules/${name}.md`,

  // Title format: "Description (rule-name)" — bare rule name, no plugin prefix
  ruleDocTitleFormat: "desc-parens-name",

  // Notices injected at top of each rule doc
  ruleDocNotices: ["configs", "fixableAndHasSuggestions", "requiresTypeChecking"],
};

export default config;

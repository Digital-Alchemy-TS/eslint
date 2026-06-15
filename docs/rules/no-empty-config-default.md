# Disallow empty-string defaults in Digital Alchemy `configuration` entries (`no-empty-config-default`)

<!-- end auto-generated rule header -->

## What this rule enforces

A Digital-Alchemy `configuration` block inside `CreateLibrary` or `CreateApplication` must not
use an empty string (`""`) as the `default` for a config key. Every config key with a `default`
value must supply a meaningful non-empty string, or use `required: true` to declare the value
mandatory.

The rule inspects every `configuration: { KEY: { ..., default: "" } }` pattern in source. Only
string `Literal` nodes are checked — numeric, boolean, and other literal types are silently skipped
because the rule has no semantics for non-string kinds.

## Why

An empty-string default is almost always a mistake. It silently substitutes `""` at runtime,
letting code that checks for a value proceed as if one was configured when none was. A service that
depends on a meaningful host, path, or token will fail at runtime instead of at startup. Forcing
the author to either provide a real default or declare the key `required: true` moves configuration
errors to startup, where they are easy to diagnose.

## Incorrect

```ts
// ❌ empty-string default is not a meaningful value
CreateLibrary({
  configuration: {
    TMUX_SOCKET_DIR: { type: "string", default: "" },
  },
});
```

## Correct

```ts
// ✅ meaningful default
CreateLibrary({
  configuration: {
    TMUX_SOCKET_DIR: { type: "string", default: "/tmp/tmux-sockets" },
  },
});

// ✅ required: true — no default needed
CreateLibrary({
  configuration: {
    TMUX_SOCKET_DIR: { type: "string", required: true },
  },
});
```

## When Not To Use It

This rule is intended for codebases that use the Digital-Alchemy `CreateLibrary` /
`CreateApplication` configuration API. If your project does not use that API or intentionally
allows empty-string defaults for a specific key, you can disable the rule for that line with an
inline eslint-disable comment.

# Module files must source their services from local subfolders, not parent directories (`module-local-imports`)

<!-- end auto-generated rule header -->

## What this rule enforces

A Digital-Alchemy module file (`*.module.mts`) declares its services in a
`services` object. This rule requires that every value used as a service is
imported from the module's own subtree — a `./services` subfolder, a package, a
local relative path — and **not** reached up through `..` into a parent
directory.

The rule only inspects `*.module.mts` files. Service factories listed in the
`services` object are checked against the file's imports: if a service value
resolves to an import whose source begins with `..`, it is reported on the
offending `import` statement.

Library composition is intentionally exempt. Importing a `LIB_*` declaration
from a parent directory and passing it through `libraries:` is the normal way
modules compose, so those imports are never flagged — only entries that actually
appear in `services` are considered.

## Why

A module should own the services it wires. When a `services` entry is imported
from a parent directory, ownership becomes ambiguous: the service physically
lives in a sibling or ancestor module's territory, yet this module wires it. That
couples the two modules' folder layouts together and makes it unclear which
module is responsible for the service's lifecycle.

Keeping service sources inside the module's own subtree means the module's
boundary on disk matches its boundary in the wiring graph. Anyone reading the
folder can see exactly which services belong to the module without tracing
imports up and out of the directory.

## Incorrect

```ts
// src/app-cli/app-cli.module.mts
import { CliService } from "../services/index.mts"; // ❌ reaches into a parent dir

export const APP = CreateApplication({
  name: "app",
  services: { cli: CliService },
});
```

## Correct

```ts
// src/app-cli/app-cli.module.mts
import { CliService } from "./services/index.mts"; // ✅ from the module's own subtree

export const APP = CreateApplication({
  name: "app",
  services: { cli: CliService },
});
```

Library imports from a parent directory are fine, because they compose through
`libraries:` rather than being owned as services:

```ts
// src/app/app.module.mts
import { LIB_DB } from "../db/index.mts"; // ✅ library composition, not a service

export const APP = CreateApplication({
  libraries: [LIB_DB],
  name: "app",
  services: {},
});
```

## When Not To Use It

This rule is intended for codebases that follow the Digital-Alchemy module model
and keep each module's services inside the module's own folder. If your project
deliberately shares service factories across directory boundaries, or does not
use the `*.module.mts` convention, this rule has nothing to match and is safe to
leave disabled.

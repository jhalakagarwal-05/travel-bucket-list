---
name: Dependency overrides
description: Dependency-resolution caveat and rationale for the Drizzle loader replacement.
---

Verify dependency overrides against both the installed tree and the lockfile, not just installation success.

**Why:** npm accepted a scoped esbuild override but repeatedly kept the old locked transitive version, even after deduplication and a targeted update.

**How to apply:** Check the resolved dependency tree and audit after security changes. Do not treat a declaration in package.json as proof that a vulnerable package was replaced.

Prefer the maintained tsx successor over Drizzle tooling's deprecated esbuild-kit loader until upstream removes that dependency.

**Why:** The latest stable Drizzle tooling still depended on the deprecated loader and its vulnerable esbuild; replacing the loader removed that chain while schema generation and application tests continued to pass.

**How to apply:** Preserve this compatibility workaround until an upstream stable upgrade eliminates the deprecated loader; verify TypeScript schema/config loading when changing it.

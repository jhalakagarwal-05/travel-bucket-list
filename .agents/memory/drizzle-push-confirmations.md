---
name: Drizzle push confirmations
description: Handling Drizzle Kit schema pushes in noninteractive runs.
---

Drizzle Kit `push` can require interactive confirmation for additive schema changes, so it may fail in CI or post-merge hooks with closed stdin.

**Why:** The noninteractive runner cannot answer Drizzle's schema-change prompt, while force flags can bypass safety checks for destructive changes.

**How to apply:** Inspect the proposed SQL first. Use a force flag only for reviewed, additive changes; keep general-purpose automation unforced so potentially destructive changes stop for review.

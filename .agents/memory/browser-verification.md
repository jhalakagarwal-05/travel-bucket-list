---
name: Browser verification
description: Observed limitation in the workspace's browser-testing callback.
---

The testing worker has returned `Unknown config kind: testing` even when platform notices said automated testing was available.

**Why:** Repeated attempts across authentication and destination work could not launch the advertised browser tester.

**How to apply:** If this error persists, do not repeatedly retry the same callback or claim signed-in UI verification. Use direct integration tests for API behavior and clearly distinguish them from rendered, interactive browser checks. Do not bypass authentication for screenshots.

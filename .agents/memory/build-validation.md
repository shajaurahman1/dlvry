---
name: Build validation
description: Environment constraints that affect validating this TanStack Start project
---

The current dependency set expects Node 22 or newer. The production build can complete client and server compilation but still fail during TanStack Start's prerender preview startup when the container cannot bind IPv6 (`EAFNOSUPPORT` on `::`).

**Why:** Validation in this workspace previously used Node 20 and an IPv6-disabled container, producing environment errors that were not source-code failures.

**How to apply:** Use the managed Node 22 runtime for checks, distinguish compile output from the final prerender step, and do not attribute an IPv6 bind failure to application code without a source-level error.
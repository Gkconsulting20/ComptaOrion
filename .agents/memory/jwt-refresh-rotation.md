---
name: JWT refresh rotation
description: Why each rotated refresh token must be cryptographically unique.
---

Every refresh-token issuance must include a unique random identifier, such as a `jti`, in its signed payload. JWTs with identical claims signed in the same second can otherwise be byte-for-byte identical, so a refresh operation may appear to rotate the token while preserving the same credential.

**Why:** An isolated end-to-end authentication test exposed identical refresh JWTs generated during rapid successive requests.

**How to apply:** Keep a test that logs in, refreshes immediately, and asserts the refresh cookie changes; retain a cryptographically random claim per issuance.

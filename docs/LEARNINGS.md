# The Black Grimoire: Lessons from the Abyss

> **Purpose**: A persistent log of failure modes, architectural dead-ends, and environmental quirks.
> **Format**: Each entry must include the Context, the Failure, and the Solution/Workaround.

## 2026-02-17: The 401 Loop of Death (Secret Mismatch)
**Context**: "Zero Local Secrets" migration.
**Failure**: Local `wrangler dev` and Edge `worker-bees` drifted in secret state. Bees bombarded the router with invalid keys, causing a `401 Unauthorized` infinite loop.
**Solution**: Synchronized secret injection via `scripts/recover-secrets.sh` (V2) and enforced strict `[vars]` hygiene in `wrangler.toml`.
**Lesson**: Never use `[vars]` for secrets in `wrangler.toml`. Always use `wrangler secret put`.

## 2026-02-17: The Hostile Environment (Corporate Proxy)
**Context**: Zscaler breaking SSL connections.
**Failure**: `npm install` and `git` operations failing with "Self Signed Certificate in Chain".
**Solution**: Extracted corporate root CA using `scripts/extract_certs.js` and configured Node/Git to trust it.
**Lesson**: Trust nothing. The network is hostile.

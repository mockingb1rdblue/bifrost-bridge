# Code Audit Report: Worker-perplexity-proxy

## Critical Issues

**Global Mutable State in Rate Limiting**
The `RATE_LIMITS` Map stores request-scoped state at module level, violating a core Workers constraint[5]. Workers reuse isolates across requests, causing the rate limiter to accumulate state indefinitely and create cross-request data leaks. This violates the strict guidance to "avoid global mutable state"[5]. Every request adds entries to this Map without cleanup, leading to unbounded memory growth.

**Outdated Compatibility Date**
The `wrangler.toml` specifies `compatibility_date = "2024-01-01"`, but the recent best practices guide (February 2026) emphasizes: "Keep your compatibility date current and enable"[5]. This prevents access to the latest runtime features, Node.js built-in modules, and security patches.

**Incomplete Secret Configuration Validation**
The code expects `PERPLEXITY_API_KEY` and `PROXY_API_KEY` via the `Env` interface, but there is no runtime validation that these secrets exist before use. Missing validation could cause cryptic runtime errors. The README correctly notes using `wrangler secret put` rather than committing secrets, but the code lacks defensive checks.

## Improvements

**Rate Limiting Storage Architecture**
Replace the in-memory Map with Cloudflare Workers KV or a per-client session token approach. Current implementation cannot scale beyond a single Worker isolate and violates isolation guarantees. Use service bindings for Worker-to-Worker communication if coordination is needed, as they are "zero-cost" and bypass the public internet[3].

**Security: Use Web Crypto API**
For `PROXY_API_KEY` validation and any random token generation, use `crypto.randomUUID()` or `crypto.getRandomValues()` instead of `Math.random()`, which is not cryptographically secure[3].

**Observability Configuration**
Enable Workers Logs and Traces before production deployment[5]. The codebase shows no logging configuration; add structured, SOC 2-audit-compliant logging as recommended for proxy services[1].

**Constant-Time Comparison: Expand Usage**
The `constantTimeCompare` function exists but may not be applied consistently. Ensure all authentication token comparisons (both `PROXY_API_KEY` and request signatures) use this function to prevent timing attacks[1].

**Error Handling Strictness**
The truncated code likely lacks comprehensive error handling. Add explicit error boundaries for:
- Invalid JSON payloads from upstream requests
- Upstream API timeouts (set aggressive timeouts to prevent Worker timeout)
- Malformed rate limit keys (ensure key derivation is deterministic and safe)

**TypeScript Configuration**
Ensure `tsconfig.json` includes strict mode settings:
- `"strict": true`
- `"noImplicitAny": true`
- `"strictNullChecks": true`
- `"noUnusedLocals": true`

## Refactoring Plan

1. **Replace in-memory rate limiting** with a KV-backed token bucket or a stateless approach using request headers (e.g., track via client IP + API key with short-lived counters).

2. **Update compatibility date** to `2026-02-15` or later to align with the current best practices release[5].

3. **Add environment variable validation** at Worker startup:
```typescript
function validateEnv(env: Env): void {
  if (!env.PERPLEXITY_API_KEY || !env.PROXY_API_KEY) {
    throw new Error("Missing required secrets: PERPLEXITY_API_KEY, PROXY_API_KEY");
  }
}
```

4. **Implement structured logging** for all authentication attempts, rate limit rejections, and upstream errors. Use minimal but audit-ready logs as recommended[1].

5. **Apply API protection patterns** for the Perplexity upstream calls: validate request structure, enforce strict Content-Type headers, and use short-lived credentials if forwarding user auth tokens[2].

6. **Add request validation** before forwarding to Perplexity API (validate schema, enforce maximum request size, sanitize headers).

7. **Document "Zero Secrets" compliance** in code comments: confirm that no secrets are logged, cached, or stored in response metadata. The README acknowledges this; the implementation must enforce it via code review gates.
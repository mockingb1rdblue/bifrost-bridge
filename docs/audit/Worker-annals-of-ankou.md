# Audit Report: Annals of Ankou Worker Component

## Critical Issues

### 1. **Type Safety Violations (High Risk)**

The codebase extensively uses `any` type annotations in request/reply handlers[1], undermining TypeScript's type safety guarantees. Line in `index.ts` shows:

```typescript
fastify.addHook('onRequest', async (request: any, reply: any) => {
```

This defeats strict mode benefits and creates maintenance blind spots.

**Also Critical:** The route handler references undefined `req` instead of `request`:

```typescript
const { type, source, topic, correlation_id, payload, meta } = req; // ❌ undefined variable
```

This will crash at runtime.

### 2. **Credential Exposure via Console Logging**

`index.ts` logs environment variables to stdout:

```typescript
console.log('Environment PORT:', process.env.PORT);
console.log('Environment DB_PATH:', process.env.DB_PATH);
```

This violates "Zero Secrets" compliance—DB paths and sensitive config leak into container logs, visible to unauthorized parties.

### 3. **Insufficient Authentication Hardening**

The bearer token validation uses string equality comparison without constant-time checking:

```typescript
if (!authHeader || authHeader !== `Bearer ${secret}`) {
```

This is vulnerable to timing attacks. The check also silently succeeds when `EVENTS_SECRET` is undefined (development fallback), creating inconsistent security posture between environments. No JWT validation is performed[4]—just a raw secret string comparison.

### 4. **Missing Request Validation**

No JSON Schema validation exists for incoming `EventBody` payloads[3]. The `payload` field accepts arbitrary JSON without constraints, enabling malformed data injection and storage bloat.

### 5. **Framework Mismatch**

`fly.toml` and `wrangler.toml` reference Cloudflare Workers infrastructure, but the code runs Fastify (Node.js). This creates deployment confusion and inconsistent security models.

---

## Improvements

### 1. **Enforce Strict TypeScript Configuration**

The `tsconfig.json` must enforce:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitThis": true,
    "exactOptionalPropertyTypes": true
  }
}
```

Replace all `any` with explicit types. Use Fastify's generic type parameters for request/reply[1]:

```typescript
fastify.post<{ Body: EventBody }>('/events', async (request, reply) => {
  // Automatically typed—no 'any' needed
});
```

### 2. **Implement Secure-by-Default Security Headers**

Apply security headers automatically to all routes[2]:

```typescript
fastify.addHook('onSend', async (request, reply) => {
  reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  reply.header('Content-Security-Policy', "default-src 'self'");
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.removeHeader('Server');
});
```

This provides A+ security rating coverage without per-route configuration[2].

### 3. **Add Schema-Based Validation**

Define JSON Schema for `EventBody` and validate automatically[3]:

```typescript
const eventSchema = {
  type: 'object',
  required: ['type', 'source', 'payload'],
  properties: {
    type: { type: 'string', maxLength: 255 },
    source: { type: 'string', maxLength: 255 },
    payload: { type: 'object', maxProperties: 100 },
    correlation_id: { type: 'string', pattern: '^[a-zA-Z0-9-]{36}$' },
  },
};

fastify.post('/events', { schema: eventSchema }, async (request, reply) => {
  // Payload automatically validated and typed
});
```

### 4. **Remove Environment Variable Logging**

Delete console output of `process.env` values. Use structured logging only for debug mode:

```typescript
if (process.env.DEBUG === 'true') {
  fastify.log.debug('Startup configuration loaded');
}
```

### 5. **Implement Cryptographically Secure Token Validation**

Use `crypto.timingSafeEqual()` for bearer token comparison and integrate JWT validation[4]:

```typescript
import { timingSafeEqual } from 'crypto';

fastify.addHook('onRequest', async (request, reply) => {
  const secret = process.env.EVENTS_SECRET;
  if (!secret) {
    return reply.code(403).send({ error: 'Authentication disabled' });
  }

  const authHeader = request.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  try {
    timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
});
```

### 6. **Clarify Deployment Target**

Either:

- **Option A:** Remove `wrangler.toml` and deploy as Node.js (Fly.io/Railway/Render).
- **Option B:** Migrate to Cloudflare Workers with a compatible framework (Hono, Itty Router).

Current dual configuration is unmaintainable.

---

## Refactoring Plan

### Phase 1: Type Safety & Immediate Security (Week 1)

1. Fix the `req` → `request` variable name bug immediately (production blocker).
2. Replace all `any` types with explicit Fastify types.
3. Remove all `console.log(process.env.*)` statements.
4. Add `strict: true` to `tsconfig.json` and fix resulting type errors.

### Phase 2: Validation & Authentication (Week 1–2)

1. Define JSON Schema for `EventBody` and apply to POST `/events`.
2. Replace string equality auth check with `timingSafeEqual()`.
3. Add environment variable validation on startup (fail if `EVENTS_SECRET` undefined in production).
4. Add error handling middleware to catch validation failures and database errors.

### Phase 3: Security Hardening (Week 2)

1. Implement secure-by-default headers using `onSend` hook[2].
2. Add CORS configuration (currently missing).
3. Implement rate limiting on `/events` POST endpoint.
4. Add audit logging for authentication failures.

### Phase 4: Infrastructure & Testing (Week 2–3)

1. Consolidate deployment config: choose Fly.io OR Cloudflare Workers (not both).
2. Expand `integration.test.ts` with error cases (malformed payload, missing auth, etc.).
3. Add database transaction rollback tests for concurrent writes.

### Phase 5: Compliance & Documentation (Week 3)

1. Document "Zero Secrets" compliance: no environment variables in logs.
2. Update ARCHITECTURE.md with security model and threat assumptions.
3. Add `.env.example` file (no actual values) to guide developers.
4. Add GitHub Actions workflow to enforce strict TypeScript and test coverage.

**Estimated Effort:** 3–5 days for full remediation. Critical issues (Phase 1) should be addressed within 24 hours.

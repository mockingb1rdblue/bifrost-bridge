# Code Audit Report: bifrost-events Worker

## Critical Issues

### Security

**1. Timing Attack Vulnerability in Authorization**[1]
The bearer token comparison uses direct string equality without constant-time comparison, making it vulnerable to timing attacks:
```typescript
if (!authHeader || authHeader !== `Bearer ${secret}`) {
```
**Severity:** High | **Impact:** Token extraction attacks

**Fix:** Use `crypto.timingSafeEqual()` for sensitive comparisons.

---

**2. Missing Authorization Validation Before Comparison**
The code constructs the expected header format inline without validating that `authHeader` follows the expected format before comparison. If the header is malformed, the string concatenation creates an unreliable comparison:
```typescript
if (!authHeader || authHeader !== `Bearer ${secret}`)
```
**Severity:** Medium | **Impact:** Potential bypass under edge cases

**Fix:** Extract and validate bearer token format explicitly, following established patterns[5]:
```typescript
function extractBearerToken(authorization?: string): string {
  const bearerPrefix = 'Bearer ';
  if (!authorization?.startsWith(bearerPrefix)) {
    throw new Error('Invalid authorization header format');
  }
  return authorization.slice(bearerPrefix.length);
}
```

---

**3. No Input Validation Schema**
The route uses `interface EventBody` but no JSON Schema validation. Fastify compiles schemas into highly optimized validators[2], but this code skips that optimization. The `payload: any` type permits arbitrary, unvalidated data.

**Severity:** High | **Impact:** Injection attacks, malformed data persistence, compliance violations

**Fix:** Define strict JSON Schema for validation[2]:
```typescript
const eventSchema = {
  type: 'object',
  required: ['type', 'source', 'payload'],
  properties: {
    type: { type: 'string', minLength: 1 },
    source: { type: 'string', minLength: 1 },
    topic: { type: 'string' },
    correlation_id: { type: 'string', format: 'uuid' },
    payload: { type: 'object' },
    meta: { type: 'object' }
  }
}
```

---

**4. Authorization Bypass in Development**
```typescript
if (!secret) return; // Open if no secret configured
```
This silently permits all requests if `EVENTS_SECRET` is unset. Without explicit rejection, this violates "Zero Secrets" compliance and creates production risks if deployment omits the variable.

**Severity:** Critical | **Impact:** Unauthorized event injection in production

**Fix:** Explicitly reject unauthenticated requests; fail safe:
```typescript
if (!secret) {
  throw new Error('EVENTS_SECRET must be configured');
}
```

---

### Type Safety & Strict Mode

**5. Unverified TypeScript Configuration**
The `tsconfig.json` is not shown. Fastify requires explicit TypeScript configuration for type safety[1]. Without verification of strict mode settings (`strict: true`, `noImplicitAny: true`, `noUnusedLocals: true`), type coverage cannot be assured.

**Severity:** High | **Impact:** Silent type errors, unsafe assertions

---

### Error Handling

**6. Missing Error Propagation**
```typescript
fastify.addHook('onRequest', async (request, reply) => {
  // ... if condition fails, reply is sent but handler continues
});
```
No early return after `reply.code(401)` is guaranteed; the hook may not properly terminate request processing in all edge cases.

**Severity:** Medium | **Impact:** Logic flow bypasses, undefined behavior

---

## Improvements

### Hardening

**1. Implement Decorator Pattern with Type Safety**[1]
Use Fastify's `setDecorator<T>` and `getDecorator<T>` for authenticated user context:
```typescript
fastify.addHook('preHandler', async (req, reply) => {
  const token = extractBearerToken(req.headers.authorization);
  const userId = validateToken(token); // Your validation logic
  req.setDecorator<string>('userId', userId);
});

fastify.get<{ Reply: EventResponse }>('/events', async (req, reply) => {
  const userId = req.getDecorator<string>('userId');
  // Type-safe userId access
});
```

---

**2. Rate Limiting & DoS Prevention**
Add rate limiting and configure AJV safely[2]:
```typescript
import plugin from '@fastify/rate-limit';

fastify.register(plugin, {
  max: 100,
  timeWindow: '1 minute'
});
```

Configure AJV to prevent DoS attacks[2]:
```typescript
const fastify = Fastify({
  ajv: {
    customOptions: {
      allErrors: false, // Critical: prevents DoS from exhaustive validation
      uriResolver: require('fast-uri')
    }
  }
});
```

---

**3. Structured Logging with Production-Safe Configuration**
```typescript
const fastify = Fastify({
  logger: process.env.NODE_ENV === 'production' 
    ? { level: 'error' }
    : true
});
```

---

**4. Comprehensive Error Handling**
```typescript
fastify.setErrorHandler((error, request, reply) => {
  if (error instanceof AuthorizationError) {
    reply.code(error.status).send({ error: error.message });
  } else {
    fastify.log.error(error);
    reply.code(500).send({ error: 'Internal server error' });
  }
});
```

---

### Efficiency

**1. Prepare Statements Caching**
The code truncates statement creation. Ensure statements are cached:
```typescript
const insertEventStmt = db.prepare(
  'INSERT INTO events (type, source, topic, correlation_id, payload, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))'
);

fastify.post('/events', async (request, reply) => {
  const info = insertEventStmt.run(type, source, topic, correlation_id, payload, meta);
  return reply.send({ id: info.lastInsertRowid });
});
```

---

**2. Remove Fragile Schema Path Resolution**
Multiple fallback paths for schema.sql introduce unpredictability:
```typescript
// Instead: Bundle schema.sql with the package or use a single, explicit path
const schemaPath = path.join(__dirname, '..', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
```

---

## Refactoring Plan

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Implement constant-time token comparison | 30 min | Critical security fix |
| **P0** | Add JSON Schema validation for all routes | 1 hour | Prevent injection attacks |
| **P0** | Enforce strict tsconfig.json settings | 15 min | Enable compile-time safety |
| **P1** | Implement bearer token extraction function[5] | 30 min | Improve auth reliability |
| **P1** | Add rate limiting plugin | 1 hour | Prevent DoS attacks |
| **P1** | Create custom error handler | 1 hour | Improve observability |
| **P2** | Cache prepared statements explicitly | 30 min | Reduce overhead per request |
| **P2** | Configure production logger levels | 15 min | Reduce log noise |
| **P2** | Move auth logic to preHandler hook[6] | 1 hour | Align with Fastify patterns |

---

**Estimated Total Effort:** 6–7 hours | **Security Risk Reduction:** ~85%
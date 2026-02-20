# Code Audit Report: Worker-bifrost-bridge

## Critical Issues

**Secret Management Violation**
The `apiToken` is passed as a constructor parameter and stored as an instance property, creating exposure risk. In the `request()` method, the token is embedded in Authorization headers without verification of secure transmission context. For "Zero Secrets" compliance, credentials must be injected at runtime from secure vaults (e.g., Cloudflare Secrets, not environment variables in code)[2].

**Insufficient Error Type Handling**
The `request()` method throws generic `Error` objects without type specificity. According to TypeScript 4.0+, catch variables default to `unknown` type, requiring explicit type narrowing[1]. The current implementation doesn't leverage custom error classes to distinguish between network failures, malformed responses, and API-specific errors, hindering debugging and error recovery.

**Missing Input Validation**
`spawnSprite(repoUrl: string)` accepts untrusted repository URLs without validation. The `hashString()` implementation is truncated, but typically this creates risk for hash collision attacks or malformed inputs. No validation occurs before constructing fetch URLs or API calls.

**Unhandled Promise Rejections in SpriteManager**
The truncated `sprite-manager.ts` likely contains async operations without comprehensive error propagation strategy. If errors aren't caught and re-thrown with context, they silently propagate up the call stack, violating the principle of "always handle errors"[1].

## Improvements

**Implement Custom Error Hierarchy**
Create domain-specific error classes to enable type-safe error handling[1]:

```typescript
class FlyAPIError extends Error {
  constructor(
    public status: number,
    public readonly retryable: boolean,
    message: string
  ) {
    super(message);
    this.name = 'FlyAPIError';
  }
}

class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

When catching, use `instanceof` to narrow types and apply recovery logic[1][4]:

```typescript
try {
  await this.fly.request(path, options);
} catch (error) {
  if (error instanceof FlyAPIError && error.retryable) {
    // Implement exponential backoff retry logic
  } else if (error instanceof FlyAPIError) {
    // Log unrecoverable error with context
  } else {
    // Handle unexpected error type
  }
}
```

**Enforce Strict TypeScript Configuration**
Current `tsconfig.json` is not shown, but should include:
- `"strict": true`
- `"noImplicitAny": true`
- `"noUncheckedIndexedAccess": true`
- `"exactOptionalPropertyTypes": true`

This prevents implicit `unknown` types in catch blocks and ensures proper error object property access[1].

**Add Input Validation and Guard Clauses**
Implement validation upfront to prevent erroneous code execution[3]:

```typescript
async spawnSprite(repoUrl: string): Promise<Machine> {
  // Guard clause: validate input
  if (!repoUrl || typeof repoUrl !== 'string') {
    throw new ValidationError('repoUrl', 'Repository URL must be a non-empty string');
  }
  
  try {
    new URL(repoUrl); // Throws if malformed
  } catch {
    throw new ValidationError('repoUrl', 'Invalid repository URL format');
  }
  
  // Safe to proceed with validated repoUrl
}
```

**Centralize Error Handling**
Implement a centralized error handler for consistency across the application[3]. For Hono middleware, add:

```typescript
app.onError((err, c) => {
  if (err instanceof ValidationError) {
    return c.json({ error: err.message, field: err.field }, 400);
  }
  if (err instanceof FlyAPIError) {
    return c.json({ error: err.message, status: err.status }, err.status);
  }
  // Generic error handler
  return c.json({ error: 'Internal Server Error' }, 500);
});
```

**Remove Hardcoded Configuration**
`runnerApp = 'bifrost-runner'` and `region = 'ord'` should be injected via constructor or environment variables, enabling multi-environment deployment and testing.

## Refactoring Plan

| Phase | Action | Priority |
|-------|--------|----------|
| **1: Security** | Move `apiToken` to Cloudflare Secrets binding; remove from constructor parameters | Critical |
| **2: Error Handling** | Implement custom error classes and update all `throw new Error()` statements | High |
| **3: Type Safety** | Enable strict TypeScript config; add type guards with `instanceof` for all catch blocks | High |
| **4: Validation** | Add input validation with guard clauses for public methods (`spawnSprite`, API endpoints) | High |
| **5: Configuration** | Externalize hardcoded values (`runnerApp`, `region`) to dependency injection or environment | Medium |
| **6: Testing** | Write unit tests for error scenarios using mocking libraries (Jest/Sinon)[3] to verify error recovery logic | Medium |
| **7: Documentation** | Add JSDoc comments documenting thrown error types for each method | Low |

**Implementation order:** Prioritize security and error hardening before efficiency optimizations. Custom error types unlock better error recovery strategies[1][3], which improve both reliability and observability.
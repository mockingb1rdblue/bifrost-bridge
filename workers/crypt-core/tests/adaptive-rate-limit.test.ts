import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Adaptive Rate Limiting', () => {
  it('throttles refill rate when queue is stressed', async () => {
    const id = env.ROUTER_DO.idFromName('adaptive-test');
    const stub = env.ROUTER_DO.get(id);

    const request = new Request('http://example.com/jules/next', {
      headers: { Authorization: 'Bearer ' + 'test-key' },
    });

    // 1. Fill the queue to trigger "Stressed" state (> 50 jobs)
    // We need to bypass the rate limiter to seed the queue quickly or just assume we have enough tokens initially
    // Since max tokens is 100, we can add 51 jobs easily.

    const jobPayload = JSON.stringify({ type: 'test', priority: 1, data: {} });
    for (let i = 0; i < 55; i++) {
      await stub.fetch(
        new Request('http://example.com/jobs', {
          method: 'POST',
          body: jobPayload,
        }),
      );
    }

    // 2. Exhaust tokens
    for (let i = 0; i < 100; i++) {
      await stub.fetch(request);
    }

    // Verify exhausted
    const failResponse = await stub.fetch(request);
    expect(failResponse.status).toBe(429);

    // 3. Wait 2 seconds
    // Normal rate: 1 token/sec * 2 sec = 2 tokens
    // Stressed rate (0.5): 0.5 token/sec * 2 sec = 1 token
    await new Promise((r) => setTimeout(r, 2100));

    // 4. Check if we have 1 or 2 tokens
    // First request should succeed (using the 1st token)
    const success1 = await stub.fetch(request);
    expect(success1.status).not.toBe(429);

    // Second request should FAIL if we are truly throttled to 0.5 req/sec
    // (If we were healthy, we'd have ~2.1 tokens, so 2 requests would likely pass or be very close)
    // Note: 2.1 * 0.5 = 1.05 tokens. So 1 request consumes 1. 0.05 left.

    const checkThrottle = await stub.fetch(request);
    expect(checkThrottle.status).toBe(429);
  });
});

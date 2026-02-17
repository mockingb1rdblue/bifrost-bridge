import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Rate Limiting', () => {
  it('enforces rate limits on burst', async () => {
    const id = env.ROUTER_DO.idFromName('rate-limit-test');
    const stub = env.ROUTER_DO.get(id);

    const request = new Request('http://example.com/jules/next', {
      headers: { Authorization: 'Bearer test-key' },
    });

    // First 100 requests should succeed (Token Bucket size is 100)
    for (let i = 0; i < 100; i++) {
      const response = await stub.fetch(request);
      // It might return 404 (No tasks) or 200, but NOT 429
      expect(response.status).not.toBe(429);
    }

    // The 101st request should fail
    const failResponse = await stub.fetch(request);
    expect(failResponse.status).toBe(429);
    expect(await failResponse.text()).toBe('Too Many Requests');
  });

  it('refills tokens over time', async () => {
    const id = env.ROUTER_DO.idFromName('rate-limit-refill-test');
    const stub = env.ROUTER_DO.get(id);

    const request = new Request('http://example.com/jules/next', {
      headers: { Authorization: 'Bearer refill-key' },
    });

    // Exhaust tokens
    for (let i = 0; i < 100; i++) {
      await stub.fetch(request);
    }

    // Verify exhausted
    const failResponse = await stub.fetch(request);
    expect(failResponse.status).toBe(429);

    // Simulate wait
    await new Promise((r) => setTimeout(r, 1100));

    // Should have 1 token now
    const successResponse = await stub.fetch(request);
    expect(successResponse.status).not.toBe(429);
  });
});

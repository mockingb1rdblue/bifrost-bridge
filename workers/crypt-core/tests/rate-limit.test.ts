import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Rate Limiting', () => {
  it('enforces rate limits on burst', async () => {
    const id = env.ROUTER_DO.idFromName('rate-limit-test');
    const stub = env.ROUTER_DO.get(id);

    const request = new Request('http://example.com/v1/swarm/next', {
      headers: { Authorization: 'Bearer ' + 'refill-key' },
    });

    // First 100 requests should succeed (Token Bucket size is 100)
    for (let i = 0; i < 100; i++) {
      const res = await stub.fetch(request);
      expect(res.status).not.toBe(429);
    }
    // ...
    const request2 = new Request('http://example.com/v1/swarm/next', {
      headers: { Authorization: 'Bearer ' + 'test-key-2' },
    });

    // Exhaust tokens
    for (let i = 0; i < 100; i++) {
      await stub.fetch(request2);
    }

    // Verify exhausted
    const failResponse = await stub.fetch(request2);
    expect(failResponse.status).toBe(429);

    // Simulate wait
    await new Promise((r) => setTimeout(r, 1100));

    // Should have 1 token now
    const successResponse = await stub.fetch(request2);
    expect(successResponse.status).not.toBe(429);
  });
});

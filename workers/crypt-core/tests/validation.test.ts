import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Validation Security', () => {
  it('rejects invalid job payload', async () => {
    const id = env.ROUTER_DO.idFromName('validation-test');
    const stub = env.ROUTER_DO.get(id);

    const response = await stub.fetch(
      new Request('http://example.com/jobs', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + 'test-key-validation' },
        body: JSON.stringify({ type: 'invalid-type' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('Invalid job payload');
  });

  it('rejects invalid task update', async () => {
    const id = env.ROUTER_DO.idFromName('validation-test');
    const stub = env.ROUTER_DO.get(id);

    const response = await stub.fetch(
      new Request('http://example.com/jules/update', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + 'test-key-validation' },
        body: JSON.stringify({ taskId: '123', status: 'unknown-status' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('Invalid task update payload');
  });
});

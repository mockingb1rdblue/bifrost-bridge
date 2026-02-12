import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { RouterDO } from '../src/router-do';

describe('Performance Monitoring & Secrets Hardening', () => {
    const DO_ID = 'test-router-id';

    beforeEach(async () => {
        // env is now populated from wrangler.toml
    });

    it('successfully passes config check with dummy secrets', async () => {
        const req = new Request('http://bifrost.local/metrics', {
            headers: { 'Authorization': `Bearer ${env.PROXY_API_KEY}` }
        });
        const res = await SELF.fetch(req);
        // If it's 200, it means checkConfig() returned null (success)
        expect(res.status).toBe(200);
    });

    it('exposes metrics via /metrics endpoint', async () => {
        const req = new Request('http://bifrost.local/metrics', {
            headers: { 'Authorization': `Bearer ${env.PROXY_API_KEY}` }
        });
        const res = await SELF.fetch(req);
        expect(res.status).toBe(200);
        const metrics = await res.json();
        expect(metrics).toHaveProperty('totalRequests');
        expect(metrics).toHaveProperty('errorCount');
    });

    it('logs errors and exposes them via /errors endpoint', async () => {
        // Trigger an error by sending invalid JSON to /jobs
        const req = new Request('http://bifrost.local/jobs', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.PROXY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: '{ invalid: json }'
        });
        await SELF.fetch(req);

        // Check /errors
        const errReq = new Request('http://bifrost.local/errors', {
            headers: { 'Authorization': `Bearer ${env.PROXY_API_KEY}` }
        });
        const res = await SELF.fetch(errReq);
        expect(res.status).toBe(200);
        const errors = await res.json() as any[];
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].context).toBeDefined();
        expect(errors[0].message).toBeTruthy();
    });
});

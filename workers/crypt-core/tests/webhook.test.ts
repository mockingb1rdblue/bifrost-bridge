
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RouterDO } from '../src/router-do';
import { verifyLinearSignature } from '../src/utils/crypto';

// Mock crypto
vi.mock('../src/utils/crypto', () => ({
    verifyLinearSignature: vi.fn(),
}));

describe('Linear Webhook Handler', () => {
    let router: RouterDO;
    let mockState: any;
    let mockEnv: any;

    beforeEach(() => {
        mockState = {
            storage: {
                get: vi.fn(),
                put: vi.fn(),
            },
            blockConcurrencyWhile: vi.fn((fn) => fn()),
        };
        mockEnv = {
            LINEAR_WEBHOOK_SECRET: 'test-secret',
            PROXY_API_KEY: 'test',
            LINEAR_API_KEY: 'test',
            LINEAR_TEAM_ID: 'test',
            GITHUB_APP_ID: 'test',
            GITHUB_PRIVATE_KEY: 'test',
            GITHUB_INSTALLATION_ID: 'test',
            DEEPSEEK_API_KEY: 'test',
            ANTHROPIC_API_KEY: 'test',
            GEMINI_API_KEY: 'test',
            PERPLEXITY_API_KEY: 'test',
        };
        router = new RouterDO(mockState, mockEnv);
    });

    it('should reject requests without signature', async () => {
        const req = new Request('http://localhost/webhooks/linear', {
            method: 'POST',
            body: JSON.stringify({}),
        });
        const res = await router.fetch(req);
        expect(res.status).toBe(400);
        expect(await res.text()).toBe('Missing Linear-Signature header');
    });

    it('should reject requests with invalid signature', async () => {
        (verifyLinearSignature as any).mockResolvedValue(false);
        const req = new Request('http://localhost/webhooks/linear', {
            method: 'POST',
            headers: { 'Linear-Signature': 'invalid' },
            body: JSON.stringify({}),
        });
        const res = await router.fetch(req);
        expect(res.status).toBe(401);
        expect(await res.text()).toBe('Invalid signature');
    });

    it('should create an orchestration job when issue moves to In Progress', async () => {
        (verifyLinearSignature as any).mockResolvedValue(true);
        const payload = {
            action: 'update',
            type: 'Issue',
            data: {
                id: 'issue-1',
                identifier: 'BIF-123',
                title: 'Test Issue',
                state: { name: 'In Progress' }
            }
        };

        const req = new Request('http://localhost/webhooks/linear', {
            method: 'POST',
            headers: { 'Linear-Signature': 'valid' },
            body: JSON.stringify(payload),
        });

        // Mock getting state to return default
        mockState.storage.get.mockResolvedValue(undefined);

        const res = await router.fetch(req);
        expect(res.status).toBe(200);

        // Verify that a job was stored
        expect(mockState.storage.put).toHaveBeenCalledWith(
            'router_state',
            expect.objectContaining({
                jobs: expect.objectContaining({
                    // We can't know the random UUID key, but we check values
                })
            })
        );

        // Inspect the call structure more deeply
        const storedState = mockState.storage.put.mock.calls[0][1];
        const jobs = Object.values(storedState.jobs);
        const job = jobs.find((j: any) => j.payload.issueIdentifier === 'BIF-123');
        expect(job).toBeTruthy();
        expect(job.type).toBe('orchestration');
        expect(job.status).toBe('pending');
    });
});

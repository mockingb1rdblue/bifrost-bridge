import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventStoreClient } from './events';

describe('EventStoreClient', () => {
    const secret = 'test-secret';
    const baseUrl = 'http://test-store:8080';
    let client: EventStoreClient;

    beforeEach(() => {
        client = new EventStoreClient({ secret, baseUrl });
        // vi.stubGlobal is often needed for fetch in vitest if not already present
        vi.stubGlobal('fetch', vi.fn());
    });

    describe('append', () => {
        it('should construct the correct HTTP request', async () => {
            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValueOnce({ ok: true } as Response);

            const event = {
                type: 'TEST_EVENT',
                source: 'test-source',
                payload: { foo: 'bar' },
            };

            await client.append(event);

            expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/events`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${secret}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(event),
                signal: expect.anything(),
            });
        });

        it('should handle non-ok responses without throwing', async () => {
            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                text: async () => 'Unauthorized',
            } as Response);

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await client.append({ type: 'T', source: 'S', payload: {} });

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('EventStore error: 401 Unauthorized'));
        });

        it('should handle connection failures without throwing', async () => {
            const mockFetch = vi.mocked(fetch);
            mockFetch.mockRejectedValueOnce(new Error('Network Error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await client.append({ type: 'T', source: 'S', payload: {} });

            expect(consoleSpy).toHaveBeenCalledWith('EventStore connection failed (timeout or network):', expect.any(Error));
        });
    });

    describe('getState', () => {
        it('should retrieve and parse state correctly', async () => {
            const mockFetch = vi.mocked(fetch);
            const mockState = { count: 10 };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockState,
            } as Response);

            const state = await client.getState('test-topic');

            expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/state/test-topic`, {
                headers: { Authorization: `Bearer ${secret}` },
                signal: expect.anything(),
            });
            expect(state).toEqual(mockState);
        });

        it('should return null on failure', async () => {
            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValueOnce({ ok: false } as Response);

            const state = await client.getState('test-topic');

            expect(state).toBeNull();
        });
    });
});

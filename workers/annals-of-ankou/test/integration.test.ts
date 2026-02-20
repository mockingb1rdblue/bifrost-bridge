import { vi, describe, beforeAll, afterAll, test, expect } from 'vitest';

// BIF-18/160/163: Mock better-sqlite3 since it fails to build on Node 25
vi.mock('better-sqlite3', () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            pragma: vi.fn(),
            exec: vi.fn(),
            prepare: vi.fn().mockImplementation((query: string) => ({
                run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
                all: vi.fn().mockImplementation((...params: any[]) => {
                    if (query.includes('DISTINCT topic')) {
                        return [{ topic: 'test-topic' }];
                    }
                    if (query.includes('COUNT(*)')) {
                        return { count: 1 };
                    }
                    // Return some mock events for filtering tests
                    return [
                        { id: 1, type: 'test.event', source: 'test', topic: 'test-topic', payload: JSON.stringify({ foo: 'bar' }), timestamp: '2026-02-16' },
                        { id: 2, type: 'other.event', source: 'test', topic: 'test-topic', payload: JSON.stringify({ baz: 'qux' }), timestamp: '2026-02-16' }
                    ].filter(e => {
                        if (query.includes('type = ?') && params.includes('test.event')) return e.type === 'test.event';
                        return true;
                    });
                }),
                get: vi.fn().mockReturnValue({ count: 1 })
            }))
        }))
    };
});

import { app } from '../src/index';

describe('Annals of Ankou Integration Tests', () => {
    beforeAll(async () => {
        // Ensure DB is clean or at least has a known state if needed
        // However, fastify app calls initDB() on load.
    });

    afterAll(async () => {
        await app.close();
    });

    test('POST /events - Success', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/events',
            payload: {
                type: 'test.event',
                source: 'test-suite',
                topic: 'test-topic',
                correlation_id: 'corr-123',
                payload: { foo: 'bar' }
            }
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.status).toBe('ok');
        expect(body.id).toBeDefined();
    });

    test('POST /events - BIF-163/165 Negative Tests', async () => {
        // Missing required fields
        const res1 = await app.inject({
            method: 'POST',
            url: '/events',
            payload: { type: 'test' }
        });
        expect(res1.statusCode).toBe(400);
        expect(JSON.parse(res1.body).error).toContain('Missing required fields');

        // Invalid correlation_id (empty string)
        const res2 = await app.inject({
            method: 'POST',
            url: '/events',
            payload: {
                type: 'test',
                source: 'test',
                correlation_id: ' ',
                payload: {}
            }
        });
        expect(res2.statusCode).toBe(400);
        expect(JSON.parse(res2.body).error).toContain('correlation_id must be a non-empty string');

        // Invalid correlation_id (wrong type)
        const res3 = await app.inject({
            method: 'POST',
            url: '/events',
            payload: {
                type: 'test',
                source: 'test',
                correlation_id: 123 as any,
                payload: {}
            }
        });
        expect(res3.statusCode).toBe(400);
    });

    test('GET /events/topics - BIF-166', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/events/topics'
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.topics).toContain('test-topic');
    });

    test('GET /events - BIF-164/167 Filtering', async () => {
        // Append another event with a different type
        await app.inject({
            method: 'POST',
            url: '/events',
            payload: {
                type: 'other.event',
                source: 'test-suite',
                topic: 'test-topic',
                payload: { baz: 'qux' }
            }
        });

        // Filter by type
        const resType = await app.inject({
            method: 'GET',
            url: '/events?type=test.event'
        });
        const eventsType = JSON.parse(resType.body);
        expect(eventsType.every((e: any) => e.type === 'test.event')).toBe(true);

        // Filter by multiple types
        const resMultiType = await app.inject({
            method: 'GET',
            url: '/events?type=test.event&type=other.event'
        });
        const eventsMultiType = JSON.parse(resMultiType.body);
        const types = eventsMultiType.map((e: any) => e.type);
        expect(types).toContain('test.event');
        expect(types).toContain('other.event');

        // Filter by topic
        const resTopic = await app.inject({
            method: 'GET',
            url: '/events?topic=test-topic'
        });
        const eventsTopic = JSON.parse(resTopic.body);
        expect(eventsTopic.every((e: any) => e.topic === 'test-topic')).toBe(true);
    });
});

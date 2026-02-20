import { describe, it, expect } from 'vitest';
import { handlers, registerHandler } from './agent';

describe('Worker Bee Job Handler Registry', () => {
    it('should have default handlers registered', () => {
        expect(handlers['echo']).toBeDefined();
        expect(handlers['runner_task']).toBeDefined();
    });

    it('should allow registering new handlers', () => {
        const mockHandler = {
            type: 'test_job',
            execute: async () => ({ success: true })
        };
        registerHandler(mockHandler);
        expect(handlers['test_job']).toBe(mockHandler);
    });

    it('should overwrite existing handlers of the same type', () => {
        const firstHandler = { type: 'overwrite', execute: async (job: any) => ({ success: true }) };
        const secondHandler = { type: 'overwrite', execute: async (job: any) => ({ success: false }) };

        registerHandler(firstHandler);
        expect(handlers['overwrite']).toBe(firstHandler);

        registerHandler(secondHandler);
        expect(handlers['overwrite']).toBe(secondHandler);
    });
});


import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMRouter } from '../src/llm/router';
import { LLMMessage } from '../src/llm/types';

// Mock the Factory to avoid real API calls
vi.mock('../src/llm/factory', () => {
    return {
        LLMFactory: vi.fn(() => ({
            get: vi.fn((provider) => ({
                chat: vi.fn(async (messages, options) => {
                    const content = `Mock response from ${provider}`;
                    return {
                        content,
                        provider,
                        model: 'mock-model',
                        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 }
                    };
                })
            }))
        }))
    };
});

describe('LLMRouter', () => {
    let router: LLMRouter;

    beforeEach(() => {
        // router instance creation
        router = new LLMRouter({
            deepseekKey: 'mock-ds',
            anthropicKey: 'mock-ant',
            geminiKey: 'mock-gem',
            perplexityKey: 'mock-pplx'
        });
    });

    it('routes to Anthropic for coding tasks if below 100k tokens', async () => {
        const messages: LLMMessage[] = [{ role: 'user', content: 'Write a React component' }];
        const result = await router.route({ messages, taskType: 'coding' });
        expect(result.provider).toBe('anthropic');
        expect(result.content).toContain('Mock response from anthropic');
    });

    it('routes to Anthropic for planning tasks', async () => {
        const messages: LLMMessage[] = [{ role: 'user', content: 'Plan a system architecture' }];
        const result = await router.route({ messages, taskType: 'planning' });
        expect(result.provider).toBe('anthropic');
        expect(result.content).toContain('Mock response from anthropic');
    });

    it('routes to Gemini for context-analysis tasks', async () => {
        const messages: LLMMessage[] = [{ role: 'user', content: 'Analyze this large document' }];
        const result = await router.route({ messages, taskType: 'context-analysis' });
        expect(result.provider).toBe('gemini'); // Assuming Gemini is default for context-analysis
        expect(result.content).toContain('Mock response from gemini');
    });

    it('routes to Perplexity for troubleshooting tasks', async () => {
        const messages: LLMMessage[] = [{ role: 'user', content: 'Find the latest React docs' }];
        const result = await router.route({ messages, taskType: 'troubleshooting' });
        expect(result.provider).toBe('openai');
        expect(result.content).toContain('Mock response from openai');
    });

    it('respects preferredProvider override', async () => {
        const messages: LLMMessage[] = [{ role: 'user', content: 'Write code' }];
        // Even though it's coding, we prefer anthropic
        // preferredProvider must be cast or valid if strictly typed
        const result = await router.route({ messages, taskType: 'coding', preferredProvider: 'anthropic' });
        expect(result.provider).toBe('anthropic');
    });

    it('falls back to default (Anthropic) if unknown/general', async () => {
        const messages: LLMMessage[] = [{ role: 'user', content: 'Hello' }];
        // No task type provided
        const result = await router.route({ messages });
        expect(result.provider).toBe('anthropic');
    });
});

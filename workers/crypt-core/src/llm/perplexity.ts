import { LLMClient, LLMMessage, LLMOptions, LLMResponse } from './types';

export class PerplexityClient implements LLMClient {
    private apiKey: string;
    private baseUrl: string;

    constructor(apiKey: string, baseUrl?: string) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl || process.env.PERPLEXITY_BASE_URL || 'https://api.perplexity.ai';
    }

    async chat(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: options.model || 'sonar-reasoning-pro',
                messages,
                temperature: options.temperature ?? 0.2, // Lower temp for factual search
                max_tokens: options.maxTokens,
                // Perplexity doesn't support some OpenAI params, but basic chat works
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Perplexity API error (${response.status}): ${error}`);
        }

        const data: any = await response.json();
        return {
            content: data.choices[0].message.content,
            usage: {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            },
            model: data.model,
            provider: 'openai', // Maps to 'openai' internally as Perplexity uses their schema
        };
    }
}

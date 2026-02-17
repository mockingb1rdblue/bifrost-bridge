import { LLMClient, LLMMessage, LLMOptions, LLMResponse } from './types';

export class DeepSeekClient implements LLMClient {
    private apiKey: string;
    private baseUrl = 'https://api.deepseek.com/v1';

    constructor(apiKey: string, baseUrl?: string) {
        this.apiKey = apiKey;
        if (baseUrl) this.baseUrl = baseUrl;
    }

    async chat(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: options.model || 'deepseek-chat',
                messages,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.maxTokens,
                stop: options.stopSequences,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`DeepSeek API error (${response.status}): ${error}`);
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
            provider: 'deepseek',
        };
    }
}

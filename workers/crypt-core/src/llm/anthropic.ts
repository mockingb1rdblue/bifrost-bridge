import { LLMClient, LLMMessage, LLMOptions, LLMResponse } from './types';

export class AnthropicClient implements LLMClient {
    private apiKey: string;
    private baseUrl = 'https://api.anthropic.com/v1/messages';

    constructor(apiKey: string, baseUrl?: string) {
        this.apiKey = apiKey;
        if (baseUrl) this.baseUrl = baseUrl;
    }

    async chat(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
        // Anthropic separates system message from user/assistant messages
        const systemMessage = messages.find((m) => m.role === 'system')?.content;
        const filteredMessages = messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content,
            }));

        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: options.model || 'claude-3-5-sonnet-20241022',
                system: systemMessage,
                messages: filteredMessages,
                max_tokens: options.maxTokens || 4096,
                temperature: options.temperature ?? 0.7,
                stop_sequences: options.stopSequences,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Anthropic API error (${response.status}): ${error}`);
        }

        const data: any = await response.json();
        return {
            content: data.content[0].text,
            usage: {
                promptTokens: data.usage.input_tokens,
                completionTokens: data.usage.output_tokens,
                totalTokens: data.usage.input_tokens + data.usage.output_tokens,
            },
            model: data.model,
            provider: 'anthropic',
        };
    }
}

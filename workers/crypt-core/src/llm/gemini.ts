import { LLMClient, LLMMessage, LLMOptions, LLMResponse } from './types';

export class GeminiClient implements LLMClient {
    private apiKey: string;
    private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

    constructor(apiKey: string, baseUrl?: string) {
        this.apiKey = apiKey;
        if (baseUrl) this.baseUrl = baseUrl;
    }

    async chat(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
        const model = options.model || 'gemini-1.5-flash';
        const systemInstruction = messages.find((m) => m.role === 'system')?.content;
        const contents = messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));

        const body: any = {
            contents,
            generationConfig: {
                maxOutputTokens: options.maxTokens,
                temperature: options.temperature ?? 0.7,
                stopSequences: options.stopSequences,
            },
        };

        if (systemInstruction) {
            body.systemInstruction = {
                parts: [{ text: systemInstruction }],
            };
        }

        const response = await fetch(`${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Gemini API error (${response.status}): ${error}`);
        }

        const data: any = await response.json();
        const candidate = data.candidates[0];

        return {
            content: candidate.content.parts[0].text,
            usage: {
                promptTokens: data.usageMetadata?.promptTokenCount || 0,
                completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
                totalTokens: data.usageMetadata?.totalTokenCount || 0,
            },
            model,
            provider: 'gemini',
        };
    }
}

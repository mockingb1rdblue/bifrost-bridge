export type LLMProvider = 'deepseek' | 'anthropic' | 'gemini' | 'openai';

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stopSequences?: string[];
}

export interface LLMResponse {
    content: string;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    model: string;
    provider: LLMProvider;
}

export interface LLMClient {
    chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
}

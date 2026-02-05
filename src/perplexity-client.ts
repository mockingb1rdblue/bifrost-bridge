import OpenAI from 'openai';
import { PERPLEXITY_MODELS } from './models';

export interface ChatOptions {
    model?: string;
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
}

export interface ResearchOptions extends ChatOptions {
    domainFilter?: string[];
    includeImages?: boolean;
}

export class PerplexityClient {
    private client: OpenAI;

    constructor(apiKey: string, baseURL?: string) {
        // Default to the official API if no proxy is provided, 
        // but in our corporate context, baseURL will likely be the proxy.
        const url = baseURL || process.env.PERPLEXITY_BASE_URL || 'https://api.perplexity.ai';

        this.client = new OpenAI({
            apiKey: apiKey,
            baseURL: url,
            dangerouslyAllowBrowser: true // often needed in weird envs, though we are node
        });
    }

    /**
     * General purpose chat completion
     */
    async chat(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[], options?: ChatOptions) {
        return await this.client.chat.completions.create({
            model: options?.model || PERPLEXITY_MODELS.SONAR_PRO,
            messages: messages,
            stream: options?.stream || false,
            temperature: options?.temperature,
            max_tokens: options?.max_tokens,
        });
    }

    /**
     * Specialized method for deep research tasks
     */
    async research(query: string, options?: ResearchOptions) {
        // Construct system prompt for research
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            {
                role: 'system',
                content: 'You are a technical research assistant. Provide comprehensive, well-cited answers. Focus on implementation details.'
            },
            {
                role: 'user',
                content: query
            }
        ];

        // Note: Perplexity specific params like 'return_citations' aren't strictly typed in OpenAI SDK
        // but they are passed through if we cast strictly or ignore type checks for the extra props.
        // However, the OpenAI Node SDK strips unknown params by default unless we circumvent it.
        // Perplexity follows OpenAI spec closely, so standard fields work. 
        // Extra fields might need a raw request if OpenAI filters them, but usually it's fine.

        return await this.client.chat.completions.create({
            model: PERPLEXITY_MODELS.SONAR_REASONING_PRO, // Default to smartest for research
            messages: messages,
            ...options
        });
    }
}

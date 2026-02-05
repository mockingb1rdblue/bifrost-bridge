import OpenAI from 'openai';
import { PERPLEXITY_MODELS } from './models';
import { withRetry, withTimeout } from './utils/retry';
import { logger } from './utils/logger';
import {
    PerplexityResponse,
    NetworkError,
    AuthenticationError,
    TimeoutError,
    ValidationError,
} from './types/perplexity';

export interface ChatOptions {
    model?: string;
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
    timeout?: number; // milliseconds
}

export interface ResearchOptions extends ChatOptions {
    domainFilter?: string[];
    includeImages?: boolean;
}

export class PerplexityClient {
    private client: OpenAI;
    private defaultTimeout: number;

    constructor(apiKey: string, baseURL?: string, defaultTimeout: number = 60000) {
        if (!apiKey || apiKey.trim() === '') {
            throw new ValidationError('API key is required');
        }

        const url = baseURL || process.env.PERPLEXITY_BASE_URL || 'https://api.perplexity.ai';
        this.defaultTimeout = defaultTimeout;

        logger.info('Initializing PerplexityClient', { baseURL: url });

        this.client = new OpenAI({
            apiKey: apiKey,
            baseURL: url,
            timeout: defaultTimeout,
            maxRetries: 0, // We handle retries ourselves
        });
    }

    /**
     * General purpose chat completion with retry and timeout
     */
    async chat(
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        options?: ChatOptions
    ): Promise<PerplexityResponse> {
        // Validate input
        if (!messages || messages.length === 0) {
            throw new ValidationError('Messages array cannot be empty');
        }

        const timeout = options?.timeout || this.defaultTimeout;
        const model = options?.model || PERPLEXITY_MODELS.SONAR_PRO;

        logger.debug('Sending chat request', { model, messageCount: messages.length });

        const makeRequest = async () => {
            try {
                const response = await this.client.chat.completions.create({
                    model,
                    messages,
                    stream: options?.stream || false,
                    temperature: options?.temperature,
                    max_tokens: options?.max_tokens,
                });

                return response as unknown as PerplexityResponse;
            } catch (error: any) {
                // Map OpenAI SDK errors to our custom types
                if (error.status === 401) {
                    throw new AuthenticationError(error.message);
                }
                if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                    throw new NetworkError('Network connection failed', error);
                }
                throw error;
            }
        };

        try {
            return await withTimeout(
                withRetry(makeRequest, {
                    maxAttempts: 3,
                    initialDelayMs: 1000,
                }),
                timeout,
                new TimeoutError(`Request timed out after ${timeout}ms`)
            );
        } catch (error) {
            logger.error('Chat request failed', error as Error, { model });
            throw error;
        }
    }

    /**
     * Specialized method for deep research tasks with extended timeout
     */
    async research(query: string, options?: ResearchOptions): Promise<PerplexityResponse> {
        // Validate query
        if (!query || query.trim() === '') {
            throw new ValidationError('Query cannot be empty');
        }
        if (query.length > 10000) {
            throw new ValidationError('Query exceeds maximum length of 10000 characters');
        }

        logger.info('Starting research query', { queryLength: query.length });

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

        // Research queries need longer timeout (default 2 minutes)
        const timeout = options?.timeout || 120000;

        return await this.chat(messages, {
            ...options,
            model: options?.model || PERPLEXITY_MODELS.SONAR_REASONING_PRO,
            timeout,
        });
    }
}

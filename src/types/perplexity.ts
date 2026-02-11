/**
 * Perplexity API Response Types
 * Based on OpenAI-compatible API spec
 */

export interface PerplexityUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface PerplexityMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface PerplexityChoice {
    index: number;
    message: PerplexityMessage;
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
}

export interface PerplexityResponse {
    id: string;
    model: string;
    created: number;
    choices: PerplexityChoice[];
    usage: PerplexityUsage;
    citations?: string[];
    images?: string[];
}

/**
 * Custom Error Types
 */
export class PerplexityError extends Error {
    constructor(
        message: string,
        public statusCode?: number,
        public response?: unknown
    ) {
        super(message);
        this.name = 'PerplexityError';
    }
}

export class NetworkError extends PerplexityError {
    public cause?: Error;

    constructor(message: string, cause?: Error) {
        super(message, 0);
        this.name = 'NetworkError';
        this.cause = cause;
    }
}

export class AuthenticationError extends PerplexityError {
    constructor(message: string = 'Invalid API key') {
        super(message, 401);
        this.name = 'AuthenticationError';
    }
}

export class RateLimitError extends PerplexityError {
    constructor(message: string = 'Rate limit exceeded', public retryAfter?: number) {
        super(message, 429);
        this.name = 'RateLimitError';
    }
}

export class TimeoutError extends PerplexityError {
    constructor(message: string = 'Request timeout') {
        super(message, 408);
        this.name = 'TimeoutError';
    }
}

export class ValidationError extends PerplexityError {
    constructor(message: string) {
        super(message, 400);
        this.name = 'ValidationError';
    }
}

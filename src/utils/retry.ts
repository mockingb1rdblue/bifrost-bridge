/**
 * Exponential backoff retry logic with jitter
 */

import { logger } from './logger';

export interface RetryOptions {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    jitterFactor?: number;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    retryableErrors?: Array<new (...args: any[]) => Error>;
    onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    retryableErrors: [],
    onRetry: () => { },
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
    attempt: number,
    initialDelay: number,
    maxDelay: number,
    multiplier: number,
    jitterFactor: number
): number {
    const exponentialDelay = initialDelay * Math.pow(multiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, maxDelay);

    // Add jitter: random value between -jitterFactor and +jitterFactor
    const jitter = cappedDelay * jitterFactor * (Math.random() * 2 - 1);

    return Math.max(0, cappedDelay + jitter);
}

/**
 * Check if error is retryable
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isRetryable(error: Error, retryableErrors: Array<new (...args: any[]) => Error>): boolean {
    if (retryableErrors.length === 0) {
        // Default: retry on network errors, timeouts, and 5xx status codes
        return (
            error.name === 'NetworkError' ||
            error.name === 'TimeoutError' ||
            (error.name === 'PerplexityError' && 'statusCode' in error &&
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                typeof (error as any).statusCode === 'number' &&
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (error as any).statusCode >= 500)
        );
    }

    return retryableErrors.some(ErrorClass => error instanceof ErrorClass);
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        try {
            logger.debug(`Attempt ${attempt}/${opts.maxAttempts}`);
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Don't retry if not retryable or last attempt
            if (!isRetryable(lastError, opts.retryableErrors) || attempt === opts.maxAttempts) {
                logger.error(`Failed after ${attempt} attempt(s)`, lastError);
                throw lastError;
            }

            const delayMs = calculateDelay(
                attempt,
                opts.initialDelayMs,
                opts.maxDelayMs,
                opts.backoffMultiplier,
                opts.jitterFactor
            );

            logger.warn(`Attempt ${attempt} failed, retrying in ${delayMs}ms`, {
                error: lastError.message,
                attempt,
                maxAttempts: opts.maxAttempts,
            });

            opts.onRetry(attempt, lastError, delayMs);

            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    throw lastError!;
}

/**
 * Create a timeout promise that rejects after specified duration
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutError?: Error): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => {
            setTimeout(() => {
                reject(timeoutError || new Error(`Operation timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        }),
    ]);
}

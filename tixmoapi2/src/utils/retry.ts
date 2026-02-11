import { logger } from '../config/logger';

interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
    jitter?: boolean;
}

/**
 * Retries a function with exponential backoff.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 10000,
        factor = 2,
        jitter = true,
    } = options;

    let lastError: any;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt > maxRetries) {
                break;
            }

            const jitterValue = jitter ? Math.random() * 200 : 0;
            const currentDelay = Math.min(delay + jitterValue, maxDelay);

            logger.warn(`Attempt ${attempt} failed. Retrying in ${Math.round(currentDelay)}ms... (Error: ${error})`);

            await new Promise(resolve => setTimeout(resolve, currentDelay));
            delay *= factor;
        }
    }

    throw lastError;
}

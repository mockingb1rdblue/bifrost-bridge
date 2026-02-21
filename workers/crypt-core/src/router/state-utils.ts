import { RouterMetrics, CircuitBreakerState, ErrorLog, RateLimitState } from '../types';

/**
 * StateUtils: Logic for metrics, circuit breakers, and rate limiting.
 */
export class StateUtils {
  static recordProviderMetric(metrics: RouterMetrics, provider: string, type: 'success' | 'failure', tokens: number = 0) {
    if (!metrics.providerStats[provider]) {
      metrics.providerStats[provider] = { requests: 0, successes: 0, failures: 0, tokens: 0 };
    }
    const stats = metrics.providerStats[provider];
    stats.requests++;
    if (type === 'success') {
      stats.successes++;
      stats.tokens += tokens;
      metrics.successCount++;
      metrics.tokensConsumed += tokens;
    } else {
      stats.failures++;
      metrics.errorCount++;
    }
  }

  static checkRateLimit(rateLimits: Record<string, RateLimitState>, metrics: RouterMetrics, key: string, maxTokens: number, refillRate: number): boolean {
    const now = Date.now();
    let limitState = rateLimits[key];
    if (!limitState) {
      limitState = { tokens: maxTokens, lastRefill: now };
      rateLimits[key] = limitState;
    }

    const timePassed = (now - limitState.lastRefill) / 1000;
    limitState.tokens = Math.min(maxTokens, limitState.tokens + timePassed * refillRate);
    limitState.lastRefill = now;

    if (limitState.tokens >= 1) {
      limitState.tokens -= 1;
      metrics.tokensConsumed++;
      return true;
    }
    return false;
  }

  static isCircuitOpen(circuitBreakers: Record<string, CircuitBreakerState>, service: string): boolean {
    const breaker = circuitBreakers[service];
    if (!breaker || breaker.state === 'closed') return false;
    // Half-open check (allow retry after 1 minute)
    return !(breaker.trippedAt && Date.now() - breaker.trippedAt > 60000);
  }

  static recordCircuitFailure(circuitBreakers: Record<string, CircuitBreakerState>, service: string, threshold: number, reason?: string) {
    if (!circuitBreakers[service]) circuitBreakers[service] = { state: 'closed', failureCount: 0 };
    const breaker = circuitBreakers[service];
    breaker.failureCount++;
    if (breaker.failureCount >= threshold) {
      breaker.state = 'open';
      breaker.trippedAt = Date.now();
      breaker.reason = reason;
    }
  }

  static attemptCircuitRecovery(circuitBreakers: Record<string, CircuitBreakerState>, service: string) {
    const breaker = circuitBreakers[service];
    if (breaker && breaker.state === 'open' && breaker.trippedAt && Date.now() - breaker.trippedAt > 300000) {
      breaker.state = 'closed';
      breaker.failureCount = 0;
      console.log(`[StateUtils] Circuit ${service} recovered.`);
    }
  }
}

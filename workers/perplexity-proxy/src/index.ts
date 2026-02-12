export interface Env {
  PERPLEXITY_API_KEY: string;
  PROXY_API_KEY: string;
}

// Maximum request body size (10MB)
// Maximum request body size (10MB)
const MAX_BODY_SIZE = 10 * 1024 * 1024;

// Rate Limiting (Token Bucket)
const RL_MAX_TOKENS = 100;
const RL_REFILL_RATE = 1; // tokens per second
const RATE_LIMITS = new Map<string, { tokens: number; lastRefill: number }>();

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Check Rate Limit (Token Bucket)
 */
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  let limitState = RATE_LIMITS.get(key);

  if (!limitState) {
    limitState = {
      tokens: RL_MAX_TOKENS,
      lastRefill: now,
    };
    RATE_LIMITS.set(key, limitState);
  }

  // Refill tokens
  const timePassed = (now - limitState.lastRefill) / 1000; // seconds
  const newTokens = timePassed * RL_REFILL_RATE;

  limitState.tokens = Math.min(RL_MAX_TOKENS, limitState.tokens + newTokens);
  limitState.lastRefill = now;

  // Consume token
  if (limitState.tokens >= 1) {
    limitState.tokens -= 1;
    return true;
  }

  return false;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 1. Authenticate the caller (Client -> Proxy) with constant-time comparison
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized: Missing Authorization header', {
        status: 401,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Extract token from "Bearer <token>" or just "<token>"
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

    if (!constantTimeCompare(token, env.PROXY_API_KEY)) {
      return new Response('Unauthorized: Invalid Proxy Key', {
        status: 401,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    // 1.5 Rate Limit Check
    if (!checkRateLimit(token)) {
      return new Response('Too Many Requests', {
        status: 429,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    // 2. Check request body size
    const contentLength = request.headers.get('Content-Length');
    if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
      return new Response('Request body too large', {
        status: 413,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    // 3. Prepare the upstream request (Proxy -> Perplexity)
    const url = new URL(request.url);
    const perplexityUrl = `https://api.perplexity.ai${url.pathname}${url.search}`;

    // Build clean headers for upstream request
    const proxyHeaders = new Headers();
    proxyHeaders.set('Authorization', `Bearer ${env.PERPLEXITY_API_KEY}`);
    proxyHeaders.set('Content-Type', 'application/json');
    if (request.headers.get('Accept')) {
      proxyHeaders.set('Accept', request.headers.get('Accept')!);
    }

    const proxyRequest = new Request(perplexityUrl, {
      method: request.method,
      headers: proxyHeaders,
      body: request.body,
    });

    try {
      const response = await fetch(proxyRequest);

      // 4. Handle specific response types (like SSE/Streaming)
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        return new Response(response.body, {
          status: response.status,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Standard response
      const responseBody = await response.blob();
      return new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'Content-Type': response.headers.get('content-type') || 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error('Proxy error:', errorMessage);

      return new Response(JSON.stringify({ error: 'Proxy Error', message: errorMessage }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};

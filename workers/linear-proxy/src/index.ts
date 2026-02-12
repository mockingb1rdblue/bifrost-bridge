/**
 * Linear API Proxy - Cloudflare Worker
 *
 * Proxies requests to Linear API to bypass corporate SSL interception.
 * Supports both GraphQL API calls and webhook handling.
 */

interface Env {
  LINEAR_API_KEY: string;
  PROXY_API_KEY: string;
  LINEAR_WEBHOOK_SECRET: string;
}

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB
const LINEAR_API_URL = 'https://api.linear.app/graphql';

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
 * Verify Linear webhook signature
 */
async function verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  // Linear uses HMAC-SHA256 for webhook signatures
  // Format: "sha256=<hex_digest>"
  const [algorithm, receivedDigest] = signature.split('=');
  
  if (algorithm !== 'sha256' || !receivedDigest) {
    return false;
  }
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );
  
  const computedDigest = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return constantTimeCompare(computedDigest, receivedDigest);
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
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Linear-Signature',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Route: /webhook - Linear webhook endpoint
    if (url.pathname === '/webhook') {
      return handleWebhook(request, env);
    }

    // Route: /graphql - Linear API proxy
    if (url.pathname === '/graphql' || url.pathname === '/') {
      return handleGraphQL(request, env);
    }

    return new Response(JSON.stringify({ error: 'Not found', path: url.pathname }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};

/**
 * Handle Linear webhook events
 */
async function handleWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Verify webhook signature
  const signature = request.headers.get('Linear-Signature') || '';
  const rawBody = await request.text();

  if (!(await verifyWebhookSignature(rawBody, signature, env.LINEAR_WEBHOOK_SECRET))) {
    return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Parse webhook payload
  const payload = JSON.parse(rawBody);

  // Log webhook event (in production, you'd process this)
  console.log('Linear webhook received:', payload);

  // Acknowledge webhook
  return new Response(JSON.stringify({ success: true, received: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Handle Linear GraphQL API requests
 */
async function handleGraphQL(request: Request, env: Env): Promise<Response> {
  // Authenticate the caller (Client -> Proxy)
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const secret = env.PROXY_API_KEY.trim();
  if (!constantTimeCompare(token, secret)) {
    return new Response(JSON.stringify({ error: 'Invalid proxy API key' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Check Rate Limit
  if (!checkRateLimit(token)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Retry-After': '60',
      },
    });
  }

  // Check request body size
  const contentLength = request.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
    return new Response(JSON.stringify({ error: 'Request body too large' }), {
      status: 413,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Prepare the upstream request (Proxy -> Linear)
  const headers = new Headers({
    'Content-Type': 'application/json',
    Authorization: env.LINEAR_API_KEY,
  });

  try {
    const body = await request.text();
    const linearRequest = new Request(LINEAR_API_URL, {
      method: 'POST',
      headers: headers,
      body: body,
    });

    const response = await fetch(linearRequest);
    const responseBody = await response.text();

    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    const err = error as Error;
    return new Response(
      JSON.stringify({
        error: 'Proxy error',
        message: err.message,
        upstream: 'Linear API',
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }
}

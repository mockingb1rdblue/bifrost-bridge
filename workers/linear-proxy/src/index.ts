/**
 * Linear API Proxy - Cloudflare Worker
 *
 * Proxies requests to Linear API to bypass corporate SSL interception.
 * Supports both GraphQL API calls and webhook handling.
 *
 * BIF-18: Structured entrypoint with typed Env
 * BIF-22: Zod-based validation and improved security
 */

import { z } from 'zod';

// --- Configuration & Schemas ---

const EnvSchema = z.object({
  LINEAR_API_KEY: z.string().min(1),
  PROXY_API_KEY: z.string().min(1),
  LINEAR_WEBHOOK_SECRET: z.string().min(1),
});

type Env = z.infer<typeof EnvSchema>;

const CONFIG = {
  MAX_BODY_SIZE: 10 * 1024 * 1024, // 10MB
  LINEAR_API_URL: 'https://api.linear.app/graphql',
  RATE_LIMIT: {
    MAX_TOKENS: 100,
    REFILL_RATE: 1, // tokens per second
  },
};

// --- State ---

// Rate Limiting (Token Bucket)
const RATE_LIMITS = new Map<string, { tokens: number; lastRefill: number }>();

// --- Helpers ---

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verify Linear webhook signature
 */
async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const [algorithm, receivedDigest] = signature.split('=');

  if (algorithm !== 'sha256' || !receivedDigest) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const computedDigest = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
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
    limitState = { tokens: CONFIG.RATE_LIMIT.MAX_TOKENS, lastRefill: now };
    RATE_LIMITS.set(key, limitState);
  }

  const timePassed = (now - limitState.lastRefill) / 1000;
  limitState.tokens = Math.min(
    CONFIG.RATE_LIMIT.MAX_TOKENS,
    limitState.tokens + timePassed * CONFIG.RATE_LIMIT.REFILL_RATE,
  );
  limitState.lastRefill = now;

  if (limitState.tokens >= 1) {
    limitState.tokens -= 1;
    return true;
  }
  return false;
}

// --- Handlers ---

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const signature = request.headers.get('Linear-Signature') || '';
  const rawBody = await request.text();

  if (!(await verifyWebhookSignature(rawBody, signature, env.LINEAR_WEBHOOK_SECRET))) {
    return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  console.log('Linear webhook received:', payload.type, payload.action);

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}

async function handleGraphQL(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!constantTimeCompare(token, env.PROXY_API_KEY.trim())) {
    return new Response(JSON.stringify({ error: 'Invalid proxy API key' }), { status: 401 });
  }

  if (!checkRateLimit(token)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 'Retry-After': '60' },
    });
  }

  const contentLength = request.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength) > CONFIG.MAX_BODY_SIZE) {
    return new Response(JSON.stringify({ error: 'Request body too large' }), { status: 413 });
  }

  try {
    const body = await request.text();
    const upResponse = await fetch(CONFIG.LINEAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: env.LINEAR_API_KEY,
      },
      body: body,
    });

    const responseBody = await upResponse.text();
    return new Response(responseBody, {
      status: upResponse.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Proxy error', message: (error as Error).message }),
      { status: 502 },
    );
  }
}

// --- Entrypoint ---

export default {
  async fetch(request: Request, env: unknown): Promise<Response> {
    // 1. Validate Environment
    const parsedEnv = EnvSchema.safeParse(env);
    if (!parsedEnv.success) {
      console.error('Environment validation failed:', parsedEnv.error.format());
      return new Response(
        JSON.stringify({
          error: 'Worker configuration error',
          details: 'Missing or invalid environment secrets',
        }),
        { status: 500 },
      );
    }

    const typedEnv = parsedEnv.data;
    const url = new URL(request.url);

    // 2. Performance: Preflight check
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Linear-Signature',
        },
      });
    }

    // 3. Routing
    try {
      if (url.pathname === '/webhook') {
        return await handleWebhook(request, typedEnv);
      }
      if (url.pathname === '/graphql' || url.pathname === '/') {
        return await handleGraphQL(request, typedEnv);
      }

      return new Response(JSON.stringify({ error: 'Not found', path: url.pathname }), {
        status: 404,
      });
    } catch (err) {
      console.error('Unhandled worker error:', err);
      return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    }
  },
};

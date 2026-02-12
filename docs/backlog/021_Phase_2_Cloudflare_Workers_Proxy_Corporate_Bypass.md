## Phase 2: Cloudflare Workers Proxy (Corporate Bypass)

### 2.1 **Perplexity API Proxy Worker** [github](https://github.com/blue-pen5805/llm-proxy-on-cloudflare-workers)

```typescript
// workers/perplexity-proxy/src/index.ts
interface Env {
  PERPLEXITY_API_KEY: string;
  PROXY_API_KEY: string; // Your auth key
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Verify proxy auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.includes(env.PROXY_API_KEY)) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Extract path and forward to Perplexity
    const url = new URL(request.url);
    const perplexityUrl = `https://api.perplexity.ai${url.pathname}`;

    const proxyRequest = new Request(perplexityUrl, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: request.body,
    });

    const response = await fetch(proxyRequest);

    // Handle streaming responses
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      return new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    return response;
  },
};
```

### 2.2 **Deploy Configuration**

```toml
# workers/perplexity-proxy/wrangler.toml
name = "perplexity-proxy"
main = "src/index.ts"
compatibility_date = "2026-01-01"

[vars]
# Add via: wrangler secret put PERPLEXITY_API_KEY
# Add via: wrangler secret put PROXY_API_KEY
```

---

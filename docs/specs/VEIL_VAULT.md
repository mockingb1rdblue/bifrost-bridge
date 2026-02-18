# Research Proxy Specification

> [!IMPORTANT]
> **Status**: Approved for Implementation
> **Phase**: 6 (Audit & Refactor)
> **Source**: Refactored from `021_Phase_2...` & `030_Perplexity...`

## Overview

The **Research Proxy** (codenamed "Veil Vault") is a Cloudflare Worker that enables secure, controlled access to external AI research APIs (Perplexity, etc.) from within corporate network constraints. It handles authentication, rate limiting, and response streaming.

## 1. Perplexity API Proxy

### Implementation
- **Platform**: Cloudflare Worker.
- **Auth**: Corporate-bypass key (`PROXY_API_KEY`) -> Upstream Key (`PERPLEXITY_API_KEY`).
- **Endpoint**: `https://api.perplexity.ai` proxy.

### Code Pattern
```typescript
interface Env {
  PERPLEXITY_API_KEY: string;
  PROXY_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.includes(env.PROXY_API_KEY)) {
      return new Response('Unauthorized', { status: 401 });
    }

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

    return fetch(proxyRequest);
  }
};
```

## 2. Integration Plan

### Usage Strategy
- **Phase 1 (Manual)**: Developer queries via CLI/Script -> Proxy -> Perplexity.
- **Phase 2 (Agentic)**: "Architect Agent" calls `research_topic` tool -> Proxy -> Perplexity -> Plan Generation.

### Perplexity Models
- `sonar-reasoning-pro`: For deep architectural planning.
- `sonar-pro`: For quick documentation lookups.

### Corporate Evasion
- **SSL Interception**: Running as a CF Worker means traffic looks like standard web traffic (`443`), often bypassing rudimentary corporate blocks on "AI APIs" if the custom domain is trusted.
- **No Local Secrets**: API keys live in Cloudflare, not on the laptop.

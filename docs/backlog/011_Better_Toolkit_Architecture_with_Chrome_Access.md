## Better Toolkit Architecture with Chrome Access

### Updated Prometheus-Unbound Structure

```typescript
// tools/network-detective.ts
// Antigravity agent automatically tests corporate environment

export async function detectCorporateRestrictions() {
  // Agent opens Chrome, tests endpoints, returns report
  return {
    blockedAPIs: ['openai.com', 'anthropic.com'],
    requiresProxy: ['mcp.linear.app'],
    sslInspection: true,
    proxyHost: 'detected.proxy.corp:8080'
  };
}

// The agent can RUN this itself and update configs accordingly
```

### Certificate Management - Fully Automated [github](https://github.com/ChromeDevTools/chrome-devtools-mcp)

```typescript
// tools/cert-manager.ts
// No manual browser clicking needed

export async function extractAllCorpCerts() {
  // Agent iterates through your common dev URLs
  // Uses Chrome DevTools Protocol [web:83][web:87]
  // Exports all certs automatically
  // Updates NODE_EXTRA_CA_CERTS paths
}
```

### Live API Testing Dashboard [antigravity](https://antigravity.codes/mcp/chrome-devtools)

```typescript
// Instead of manual testing, agent creates test page:

// Agent prompt:
"Create an HTML dashboard that tests connectivity to all my APIs 
(Perplexity, OpenAI, Linear MCP, etc.), shows status, and reports 
which ones need the proxy"

// Agent:
// - Writes the HTML
// - Opens in Chrome [web:86]
// - Uses Network panel to capture results [web:84]
// - Screenshots the dashboard [web:83]
```

***

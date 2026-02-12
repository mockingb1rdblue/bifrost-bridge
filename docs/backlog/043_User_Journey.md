## User Journey

### Day 1: Discovery

A developer joins a new company, gets issued a locked-down Windows laptop with OneDrive, heavy SSL inspection, and admin rights revoked. They try to `npm install` and get `SELF_SIGNED_CERT_IN_CHAIN`. They find Bifrost Bridge.

### Day 1 (Continued): Automated Setup

```bash
npx bifrost-bridge init
```

The Bifrost Bridge agent (running in Antigravity or as a CLI tool):

1. **Probes the network** - Tests connectivity to 50+ common dev services
2. **Extracts certificates** - Visits mcp.linear.app, api.openai.com, etc., saves all certs
3. **Generates configs** - Creates .npmrc, .gitconfig, mcp.json with correct settings
4. **Sets environment variables** - Modifies user PATH, sets NODE_EXTRA_CA_CERTS
5. **Installs portable tools** - Downloads Node.js, Git, Python to user directory
6. **Deploys proxies** - Prompts for Cloudflare API key, deploys 3 essential proxies
7. **Creates dashboard** - Opens HTML page showing what works, what's proxied, what's broken

**Time elapsed: 5 minutes. They're ready to develop.**

### Week 1: Development

The developer works on a TypeScript project using Perplexity API, needs Linear integration, and wants to deploy to Fly.io.

- **Perplexity API calls** → Route through Cloudflare Workers proxy automatically
- **Linear MCP server** → bifrost-bridge has a pre-configured proxy, it just works
- **npm install** → Uses cached packages + correct certificates, no errors
- **git push** → Credentials flow through corporate SSO, certificate validation passes
- **fly deploy** → Runs from user directory, no admin needed, tunnels through proxy

**Productivity: 95% of what they'd have on an unrestricted machine.**

### Month 1: Mastery

The developer encounters a new restriction: corporate IT blocks api.anthropic.com.

```bash
npx bifrost-bridge detect --service anthropic
```

Output:

```
❌ api.anthropic.com - BLOCKED (DNS blackhole)
✅ Solution: Deploy anthropic-proxy.js to Cloudflare Workers
🚀 Run: npx bifrost-bridge deploy anthropic-proxy

Estimated setup time: 2 minutes
```

They run the command, update their `.env` to point to the new proxy, and continue working.

**Time lost to IT restriction: 2 minutes instead of 2 days.**

### Month 6: Contribution

The developer discovers their company uses Zscaler in an unusual configuration that breaks WebSocket connections differently than documented. They:

1. Write a workaround (Cloudflare Durable Objects for long-lived connections)
2. Document the Zscaler fingerprint
3. Submit to Bifrost Bridge knowledge base
4. Now everyone at companies using Zscaler in that mode has the solution

---

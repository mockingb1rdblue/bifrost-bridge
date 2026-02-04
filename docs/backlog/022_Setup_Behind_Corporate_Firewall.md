## Setup Behind Corporate Firewall

1. Deploy proxy: `cd workers/perplexity-proxy && wrangler deploy`
2. Set env var: `PERPLEXITY_BASE_URL=https://perplexity-proxy.your-account.workers.dev`
3. Configure client to use proxy instead of direct API

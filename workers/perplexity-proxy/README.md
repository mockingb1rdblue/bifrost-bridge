# Perplexity MCP Proxy (Cloudflare Worker)

A secure bridge to bypass corporate network restrictions, allowing your local MCP client to communicate with the Perplexity API via an external Cloudflare Worker.

## 1. Prerequisites

### A. Cloudflare API Token

You need a Cloudflare API Token to deploy this worker. The "Global API Key" is insecure; do not use it.

1.  Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens).
2.  Go to **My Profile** > **API Tokens**.
3.  Click **Create Token**.
4.  Use the **Edit Cloudflare Workers** template (easiest) OR create a **Custom Token** with these permissions:
    - `Account` > `Workers Scripts` > **Edit**
    - `Account` > `Workers KV Storage` > **Edit** (Standard requirement for Wrangler)
    - `Account` > `Account Settings` > **Read**
    - `User` > `User Details` > **Read**
    - `Zone` > `Workers Routes` > **Edit**
5.  Copy the token value immediately.

### B. Environment Setup

The project follows a **strict "Zero Local Secrets" policy**.

- **Do NOT** store API keys in `.env` or `.dev.vars` files.
- **Do** use `wrangler secret put` to upload secrets to Cloudflare.
- **Do** use `npx wrangler dev --remote` for local development.

## 2. Deployment

This project uses `wrangler` to deploy.

```bash
# 1. Install dependencies
npm install

# 2. Deploy to Cloudflare
npm run deploy:proxy
# (Or run `npx wrangler deploy` inside this directory)
```

## 3. Configuration (Secrets)

For security, API keys are not stored in the code. You must upload them as secrets to the deployed worker:

```bash
# Upload Perplexity Key
npx wrangler secret put PERPLEXITY_API_KEY
# (Paste your key when prompted)

# Upload Your Proxy Password
npx wrangler secret put PROXY_API_KEY
# (Paste your chosen password when prompted)
```

## 4. Usage

Configure your local MCP Client (e.g., in Antigravity or a specialized client) to point to your new worker:

- **URL**: `https://perplexity-proxy.<your-subdomain>.workers.dev`
- **Headers**:
  - `Authorization`: `<YOUR_PROXY_API_KEY>`

The proxy will verify your key, then forward the request to Perplexity with the correct credentials.

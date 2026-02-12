# Linear API Proxy

Cloudflare Worker that proxies requests to Linear's GraphQL API and handles webhooks, bypassing corporate SSL interception.

## Features

- **GraphQL API Proxy**: Routes API requests to Linear with your API key
- **Webhook Handler**: Receives Linear webhook events
- **Security**: Constant-time authentication, CORS support, request size limits
- **Corporate SSL Bypass**: Works around SSL certificate interception

## Deployment

### 1. Install Wrangler (if not already installed)

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Set Secrets

```bash
cd workers/linear-proxy

# Set your Linear API key
wrangler secret put LINEAR_API_KEY
# Enter: <YOUR_LINEAR_API_KEY>

# Set your proxy authentication key (generate a secure random string)
wrangler secret put PROXY_API_KEY
# Enter: <generate a secure random string>

# Set your Linear webhook secret
wrangler secret put LINEAR_WEBHOOK_SECRET
# Enter: <YOUR_LINEAR_WEBHOOK_SECRET>
```

### 4. Deploy

```bash
wrangler deploy
```

After deployment, you'll get a URL like:

```
https://linear-proxy.mock1ng.workers.dev
```

## Usage

### GraphQL API Endpoint

**URL**: `https://linear-proxy.mock1ng.workers.dev/graphql`

**Authentication**: Use your `PROXY_API_KEY` as a Bearer token

**Example Request**:

```bash
curl -X POST https://linear-proxy.mock1ng.workers.dev/graphql \
  -H "Authorization: Bearer YOUR_PROXY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ viewer { id name email } }"
  }'
```

### Webhook Endpoint

**URL**: `https://linear-proxy.mock1ng.workers.dev/webhook`

Configure this URL in Linear:

1. Go to Settings → Webhooks
2. Create new webhook
3. Set URL to: `https://linear-proxy.mock1ng.workers.dev/webhook`
4. Use your webhook secret: `<YOUR_LINEAR_WEBHOOK_SECRET>`

## Environment Variables

Add to your `.env` file:

```env
LINEAR_API_KEY=<YOUR_LINEAR_API_KEY>
LINEAR_PROXY_API_KEY=<your_proxy_api_key>
LINEAR_BASE_URL=https://linear-proxy.mock1ng.workers.dev/graphql
LINEAR_WEBHOOK_URL=https://linear-proxy.mock1ng.workers.dev/webhook
```

## Security Notes

- The proxy uses constant-time comparison for authentication to prevent timing attacks
- Request body size is limited to 10MB
- CORS is enabled for browser-based clients
- All secrets are stored in Cloudflare's encrypted secret storage

## Local Development

Create `.dev.vars` file:

```env
LINEAR_API_KEY=<YOUR_LINEAR_API_KEY>
PROXY_API_KEY=your_local_proxy_key
LINEAR_WEBHOOK_SECRET=<YOUR_LINEAR_WEBHOOK_SECRET>
```

Run locally:

```bash
wrangler dev
```

## Troubleshooting

**401 Unauthorized**: Check that your `PROXY_API_KEY` matches between client and worker

**413 Request Too Large**: GraphQL query exceeds 10MB limit

**502 Bad Gateway**: Linear API is unreachable or returned an error

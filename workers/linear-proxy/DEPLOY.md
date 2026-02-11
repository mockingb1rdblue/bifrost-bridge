# Deploy Linear Proxy

## Quick Deploy Instructions

### Option 1: Manual Deploy (Recommended)

1. **Open a new PowerShell terminal** (not in this IDE)

2. **Navigate to the worker directory:**
   ```powershell
   cd "c:\Users\ad9840724\OneDrive - Nutrien\Documents\My Role\01_DEVELOPMENT_LAB\bifrost-bridge\workers\linear-proxy"
   ```

3. **Deploy the worker:**
   ```powershell
   npx wrangler deploy
   ```

<<<<<<< HEAD
=======
4. **Set the secrets:**
   ```powershell
   # Linear API Key
   npx wrangler secret put LINEAR_API_KEY
   # When prompted, enter: <YOUR_LINEAR_API_KEY>

   # Proxy API Key (generate a secure random string or use the Perplexity one)
   npx wrangler secret put PROXY_API_KEY
   # When prompted, enter your proxy key

   # Linear Webhook Secret
   npx wrangler secret put LINEAR_WEBHOOK_SECRET
   # When prompted, enter: <YOUR_LINEAR_WEBHOOK_SECRET>
   ```

>>>>>>> feature/060-linear-proxy
### Option 2: Use .dev.vars for Local Testing

Create `workers/linear-proxy/.dev.vars`:
```env
LINEAR_API_KEY=<YOUR_LINEAR_API_KEY>
PROXY_API_KEY=your_proxy_key_here
LINEAR_WEBHOOK_SECRET=<YOUR_LINEAR_WEBHOOK_SECRET>
```

Then run locally:
```powershell
npx wrangler dev
```

## Expected URLs After Deployment

After successful deployment, you'll get:

**GraphQL API Endpoint:**
```
https://linear-proxy.mock1ng.workers.dev/graphql
```

**Webhook Endpoint (for Linear settings):**
```
https://linear-proxy.mock1ng.workers.dev/webhook
```

## Configure Linear Webhook

1. Go to Linear → Settings → Webhooks
2. Click "Create webhook"
3. Set URL to: `https://linear-proxy.mock1ng.workers.dev/webhook`
4. Set secret to: `<YOUR_LINEAR_WEBHOOK_SECRET>`
5. Select events you want to receive
6. Save

## Test the Deployment

```powershell
# Test GraphQL endpoint
curl -X POST https://linear-proxy.mock1ng.workers.dev/graphql `
  -H "Authorization: Bearer YOUR_PROXY_API_KEY" `
  -H "Content-Type: application/json" `
  -d '{"query": "{ viewer { id name email } }"}'
```

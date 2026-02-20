# Zero Local Secrets & Cloud Vault Protocol

> [!IMPORTANT]
> **GLOBAL RULE**: Never commit real secrets to this repository. All sensitive keys are managed via the Cloud Vault (Cloudflare KV).

This project enforces a **Zero Local Secrets** policy to ensure security, prevent environment drift, and facilitate seamless transitions between local development and cloud-native execution.

## 🔐 The Cloud Vault

We use a Cloudflare KV namespace as our centralized secret store:

- **Namespace Title**: `bifrost-bridge-BIFROST_KV`
- **Access Method**: Strictly through the `secure:exec` wrapper.

## 🚀 Local Development Workflow

To run any script or worker locally with access to secrets:

1.  **Authenticate**: Ensure you are logged into Cloudflare.
    ```bash
    npx wrangler login
    ```
2.  **Execute**: Prefix your command with `npm run secure:exec`.
    ```bash
    npm run secure:exec npx tsx scripts/your-script.ts
    ```

The `scripts/infra/secure-connect.ts` utility will:

- Authenticate with Cloudflare KV.
- Pull required keys into memory.
- Prompt you (once) for missing keys and save them securely to the cloud.
- Inject keys into the child process environment without writing them to disk.

## 📋 Secret Inventory

The following secrets are expected and managed via the Cloud Vault:

| Key Name                | Description                                    |
| :---------------------- | :--------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare Account ID.                    |
| `CLOUDFLARE_API_TOKEN`  | Token with KV Edit permissions.                |
| `PERPLEXITY_API_KEY`    | API Key for Perplexity AI (Sonar models).      |
| `PERPLEXITY_BASE_URL`   | Base URL for Perplexity API.                   |
| `PROXY_API_KEY`         | Secret key for our internal LLM Proxy workers. |
| `LINEAR_API_KEY`        | API Key for Linear project management.         |
| `LINEAR_TEAM_ID`        | Default Linear Team ID for task creation.      |
| `GEMINI_API_KEY`        | Google AI SDK key (Flash/Pro models).          |
| `VELLUM_API_KEY`        | API Key for Vellum.ai unified SDK.             |
| `FLY_API_TOKEN`         | Token for Fly.io deployments (Worker Bees).    |

## 🛠️ Infrastructure Consistency

- **CI/CD**: GitHub Actions use the same keys stored in GitHub Secrets.
- **Production**: Worker secrets are set via `wrangler secret put` or `fly secrets set`.

Refer to [.agent/workflows/secure-secrets.md](file:///.agent/workflows/secure-secrets.md) for the full regulatory policy.

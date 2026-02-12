## Core Infrastructure

### 1. **MCP Server Proxies** (Current Work)

- Cloudflare Workers proxies for MCP servers behind corporate firewalls
- Generic proxy template for any remote MCP service
- Pre-configured proxies for: Linear, GitHub, Jira, common services

### 2. **Certificate Extraction & Management**

- Automated corporate CA cert extraction script (your existing `extract-cert.js`)
- Batch certificate extractor for multiple domains
- Certificate chain validator
- Auto-detection of which certs are needed for common dev tools

### 3. **OneDrive Performance Workarounds**

- `.npmrc` template with `node_modules` exclusion patterns [linkedin](https://www.linkedin.com/pulse/today-i-learnednever-work-nodejs-onedrive-folder-sham-haque)
- PowerShell script to symlink `node_modules` outside OneDrive sync [linkedin](https://www.linkedin.com/pulse/today-i-learnednever-work-nodejs-onedrive-folder-sham-haque)
- Auto-detect OneDrive paths and suggest local alternatives
- Git config templates for OneDrive-friendly patterns (sparse checkout, ignore node_modules)

### 4. **Portable Development Environment Setup**

- Node.js portable installer script (download zip, extract, set PATH) [youtube](https://www.youtube.com/watch?v=BLnbtsDIW_E)
- Python portable setup (portable-python distributions) [portabledevapps](https://www.portabledevapps.net)
- Git portable configuration
- VS Code portable setup guide [blog.revolution.com](https://blog.revolution.com.br/2019/11/10/configuring-a-windows-developer-machine-with-no-admin-rights/)
- Environment variable manager (since you can't modify system settings easily)

### 5. **NPX & Package Management Workarounds**

- Custom npx cache manager (pre-cache common packages to avoid repeated downloads)
- Offline package bundler (download all deps on unrestricted machine, transfer to corp)
- `package.json` dependency freezer for deterministic installs
- NPM registry proxy config for corporate registries

### 6. **Network & Proxy Tools**

- HTTP/HTTPS proxy detection and auto-configuration
- Corporate proxy credential manager (secure storage)
- Network connectivity tester (which services are blocked)
- DNS resolver with corporate overrides
- Cloudflare Tunnel wrapper for local dev server exposure

### 7. **PowerShell Alternatives**

- Portable PowerShell Core installer [dev](https://dev.to/davidkou/install-anything-without-admin-rights-4p0j)
- Bash via Git Bash (portable)
- Cmder/ConEmu portable terminal [dev](https://dev.to/davidkou/install-anything-without-admin-rights-4p0j)
- Common PowerShell script equivalents in Node.js (since Node is more portable)

### 8. **API Development Behind Firewalls**

- Cloudflare Workers proxy templates for:
  - OpenAI/Anthropic/Google AI APIs
  - Discord webhooks/bots
  - GitHub API
  - Database connections (PostgreSQL, Redis via Workers)
- Request signature validator (for webhook testing locally)
- Mock API server (Fly.io deploy template for sandboxed testing)

### 9. **Database & Storage Workarounds**

- SQLite portable setup (no admin needed)
- Cloudflare D1 templates (serverless SQL)
- Redis via Cloudflare Workers KV/Durable Objects
- File storage alternatives (Cloudflare R2, not OneDrive)

### 10. **Build & Deploy Tools**

- Vite config templates optimized for OneDrive [linkedin](https://www.linkedin.com/pulse/today-i-learnednever-work-nodejs-onedrive-folder-sham-haque)
- Esbuild portable bundler
- Fly.io CLI portable setup
- Cloudflare Wrangler without global install
- GitHub Actions templates for external builds (bypass local build issues)

### 11. **Development Acceleration**

- Pre-built Docker images on Fly.io (build elsewhere, run from corp network)
- Codespaces/cloud IDE connection scripts
- VSCode Remote Development config for Fly.io machines
- Hot module reload over Cloudflare Tunnel

### 12. **Documentation & Setup**

- Corporate environment detector (auto-detect restrictions)
- One-command setup script for new machines
- Troubleshooting decision tree (which workaround for which error)
- Permission tester (what works, what doesn't on your specific corp network)

### 13. **Discord Bot Development**

- Discord gateway proxy via Cloudflare Workers
- Webhook-only bot templates (no persistent connections needed)
- CarPiggy deployment scripts for restricted environments
- Local bot testing via ngrok alternative (Cloudflare Tunnel)

### 14. **AI/LLM Integration**

- Cloudflare AI Workers templates (your existing work)
- API key manager (secure, non-admin storage)
- Rate limiter for corp-network-friendly API usage
- Prompt caching strategies for slow networks

### 15. **Monitoring & Debugging**

- Network request interceptor (see what's being blocked)
- SSL/TLS handshake debugger
- Corporate firewall rule detector
- Performance profiler for OneDrive sync impact [linkedin](https://www.linkedin.com/pulse/today-i-learnednever-work-nodejs-onedrive-folder-sham-haque)

This toolkit essentially becomes your "corporate firewall survival guide" - everything you've had to figure out the hard way, packaged for others (and future you). [blog.revolution.com](https://blog.revolution.com.br/2019/11/10/configuring-a-windows-developer-machine-with-no-admin-rights/)

---

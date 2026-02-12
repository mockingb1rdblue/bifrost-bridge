# Bifrost Workers

This directory contains cloud-side logic deployed to Cloudflare Workers.

## Standard Structure

Each worker should follow this structure:

```
worker-name/
├── src/
│   └── index.ts       # Entry point
├── package.json       # Dependencies (include @cloudflare/workers-types)
├── tsconfig.json      # TypeScript config
├── wrangler.toml      # Deployment config
└── README.md          # Worker-specific docs
```

## Shared Standards

- **TypeScript**: Strict mode enabled.
- **Wrangler**: Use `wrangler` for dev and deploy.
- **Types**: Include `@cloudflare/workers-types` in `compilerOptions.types`.

import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import path from 'node:path';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: path.resolve(__dirname, 'wrangler.toml'), environment: 'test' },
        isolatedStorage: false,
        miniflare: {
          bindings: {
            LINEAR_WEBHOOK_SECRET: 'test-secret',
            PROXY_API_KEY: 'test-key',
            LINEAR_API_KEY: 'test-linear-key',
            LINEAR_TEAM_ID: 'test-team-id',
            GITHUB_APP_ID: 'test-app-id',
            GITHUB_PRIVATE_KEY: 'test-private-key',
            GITHUB_INSTALLATION_ID: 'test-install-id',
            DEEPSEEK_API_KEY: 'test-deepseek-key',
            ANTHROPIC_API_KEY: 'test-anthropic-key',
            GEMINI_API_KEY: 'test-gemini-key',
            PERPLEXITY_API_KEY: 'test-perplexity-key',
          },
        },
      },
    },
  },
});

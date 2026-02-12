import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import path from 'node:path';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: path.resolve(__dirname, 'wrangler.toml'), environment: 'test' },
        isolatedStorage: false,
      },
    },
  },
});

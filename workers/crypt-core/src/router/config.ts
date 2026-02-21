import { Env } from '../types';

export interface RouterConfig {
  proxyApiKey: string;
  linear: {
    apiKey: string;
    webhookSecret: string;
    teamId: string;
    projectId: string;
  };
  github: {
    appId: string;
    privateKey: string;
    installationId: string;
    webhookSecret: string;
  };
  llm: {
    deepseekKey: string;
    anthropicKey: string;
    geminiKey: string;
    perplexityKey: string;
    baseUrl: string; // Shared proxy base URL
  };
  events: {
    secret: string;
    url: string;
  };
  fly: {
    token: string;
    appName: string;
  };
  rateLimit: {
    degradationThreshold: number;
    maxTokens: number;
    refillRate: number;
  };
  julesApiKey: string;
  runnerSecret: string;
  ROUTER_DO: DurableObjectNamespace;
  GOVERNANCE_DO: DurableObjectNamespace;
}

export function buildRouterConfig(env: Env): RouterConfig {
  return {
    proxyApiKey: env.PROXY_API_KEY,
    linear: {
      apiKey: env.LINEAR_API_KEY,
      webhookSecret: env.LINEAR_WEBHOOK_SECRET,
      teamId: env.LINEAR_TEAM_ID,
      projectId: env.LINEAR_PROJECT_ID,
    },
    github: {
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_PRIVATE_KEY,
      installationId: env.GITHUB_INSTALLATION_ID,
      webhookSecret: env.GITHUB_WEBHOOK_SECRET,
    },
    llm: {
      deepseekKey: env.DEEPSEEK_API_KEY,
      anthropicKey: env.ANTHROPIC_API_KEY,
      geminiKey: env.GEMINI_API_KEY,
      perplexityKey: env.PERPLEXITY_API_KEY,
      baseUrl: 'https://proxy.jules.codes/v1',
    },
    events: {
      secret: env.EVENTS_SECRET || 'dev-secret',
      url: env.EVENTS_URL || 'http://bifrost-events.flycast:8080',
    },
    fly: {
      token: env.FLY_API_TOKEN || '',
      appName: 'bifrost-runner',
    },
    rateLimit: {
      degradationThreshold: parseInt(env.RATE_LIMIT_DEGRADATION_THRESHOLD || '0.8'),
      maxTokens: parseInt(env.RATE_LIMIT_MAX_TOKENS || '100000'),
      refillRate: parseInt(env.RATE_LIMIT_REFILL_RATE || '1000'),
    },
    julesApiKey: env.JULES_API_KEY,
    runnerSecret: env.RUNNER_SECRET,
    ROUTER_DO: env.ROUTER_DO,
    GOVERNANCE_DO: env.GOVERNANCE_DO,
  };
}
